from datetime import date, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Contexte,
    Domaine,
    HistoriqueReport,
    RaisonSelection,
    SelectionJour,
    StatutJour,
    StatutTache,
    Tache,
)
from app.schemas import DecisionAction
from app.services.scoring import score

MAX_TACHES = 4
ANTI_OUBLI_JOURS = 7


def _options_selection_eager() -> list:
    """Évite le N+1 sur SelectionJour.tache et ses propres collections lazy-loaded
    (domaines, sous_taches, jalons, historique_reports) — sinon chaque tâche du jour
    déclenche jusqu'à 5 requêtes séparées vers Supabase (voir même correctif sur
    GET /notes, /taches, /veille)."""
    return [
        selectinload(SelectionJour.tache).selectinload(Tache.domaines),
        selectinload(SelectionJour.tache).selectinload(Tache.sous_taches),
        selectinload(SelectionJour.tache).selectinload(Tache.jalons),
        selectinload(SelectionJour.tache).selectinload(Tache.historique_reports),
    ]


def obtenir_ou_construire_selection(db: Session, contexte: Contexte, aujourdhui: date) -> list[SelectionJour]:
    existantes = (
        db.query(SelectionJour).filter_by(date=aujourdhui, contexte=contexte).options(*_options_selection_eager()).all()
    )
    if existantes:
        return existantes
    try:
        return _construire_selection(db, contexte, aujourdhui)
    except IntegrityError:
        # Deux requêtes concurrentes (ex. deux appareils) ont pu construire la
        # sélection du jour en même temps ; la contrainte d'unicité (date, contexte,
        # tache_id) fait échouer la perdante ici plutôt que dupliquer des lignes —
        # elle récupère simplement ce que l'autre a déjà committé.
        db.rollback()
        return (
            db.query(SelectionJour).filter_by(date=aujourdhui, contexte=contexte).options(*_options_selection_eager()).all()
        )


def _construire_selection(db: Session, contexte: Contexte, aujourdhui: date) -> list[SelectionJour]:
    toutes_eligibles = (
        db.query(Tache)
        .join(Tache.domaines)
        .filter(Domaine.contexte.in_([contexte, Contexte.les_deux]), Tache.statut == StatutTache.a_realiser)
        .distinct()
        .all()
    )
    # Les tâches récurrentes forment leur propre bloc (comme la veille) : elles ne
    # concurrencent jamais les 3-4 tâches du quota du jour.
    taches_recurrentes = [t for t in toutes_eligibles if t.recurrente]
    taches_eligibles = [t for t in toutes_eligibles if not t.recurrente]

    par_id = {t.id: t for t in taches_eligibles}
    retenues: dict[int, RaisonSelection] = {}

    # 1. épinglées manuellement
    for t in taches_eligibles:
        if t.epinglee:
            retenues[t.id] = RaisonSelection.epingle

    # 2. reportées à une échéance désormais atteinte (report d'hier à "demain", ou
    # report à une date précise dont l'échéance choisie arrive aujourd'hui). On compare
    # l'échéance choisie, pas la date à laquelle le report a été décidé : un report à
    # J+21 ne doit pas remonter dès le lendemain.
    for t in taches_eligibles:
        if t.id in retenues or not t.historique_reports:
            continue
        dernier_report = max(t.historique_reports, key=lambda r: r.date_evenement)
        if dernier_report.nouvelle_echeance is not None and dernier_report.nouvelle_echeance <= aujourdhui:
            retenues[t.id] = RaisonSelection.report_remonte

    # 3. complément par score priorité × urgence
    restantes = sorted(
        (t for t in taches_eligibles if t.id not in retenues),
        key=lambda t: score(t, aujourdhui),
        reverse=True,
    )
    for t in restantes:
        if len(retenues) >= MAX_TACHES:
            break
        retenues[t.id] = RaisonSelection.score

    # 4. anti-oubli : une tâche jamais touchée depuis ANTI_OUBLI_JOURS doit porter une décision obligatoire,
    # qu'elle ait été retenue par score ou qu'il faille la forcer dans le quota
    seuil_oubli = aujourdhui - timedelta(days=ANTI_OUBLI_JOURS)

    # 4a. requalifier celles déjà retenues par score mais éligibles à l'anti-oubli
    for tache_id, raison in list(retenues.items()):
        if raison == RaisonSelection.score and par_id[tache_id].derniere_interaction.date() <= seuil_oubli:
            retenues[tache_id] = RaisonSelection.anti_oubli

    # 4b. sinon, en forcer une dans le quota si aucune n'est déjà présente
    deja_anti_oubli = any(raison == RaisonSelection.anti_oubli for raison in retenues.values())
    if not deja_anti_oubli:
        candidates_oubli = sorted(
            (t for t in taches_eligibles if t.id not in retenues and t.derniere_interaction.date() <= seuil_oubli),
            key=lambda t: t.derniere_interaction,
        )
        if candidates_oubli:
            tache_oubliee = candidates_oubli[0]
            if len(retenues) >= MAX_TACHES:
                # On n'évince jamais une tâche épinglée manuellement : si le quota est
                # entièrement occupé par des épingles, on respecte le quota plutôt que
                # de le dépasser (l'anti-oubli sera retenté les jours suivants).
                candidats_evictables = [tid for tid, raison in retenues.items() if raison != RaisonSelection.epingle]
                if candidats_evictables:
                    moins_prioritaire = min(candidats_evictables, key=lambda tid: score(par_id[tid], aujourdhui))
                    del retenues[moins_prioritaire]
                    retenues[tache_oubliee.id] = RaisonSelection.anti_oubli
            else:
                retenues[tache_oubliee.id] = RaisonSelection.anti_oubli

    # 5. tâches récurrentes : toutes incluses, hors quota, bloc dédié
    for t in taches_recurrentes:
        retenues[t.id] = RaisonSelection.recurrente

    lignes = [
        SelectionJour(date=aujourdhui, contexte=contexte, tache_id=tache_id, raison_selection=raison)
        for tache_id, raison in retenues.items()
    ]
    db.add_all(lignes)
    db.commit()
    ids = [ligne.id for ligne in lignes]
    return db.query(SelectionJour).filter(SelectionJour.id.in_(ids)).options(*_options_selection_eager()).all()


def appliquer_decision(db: Session, selection: SelectionJour, decision: DecisionAction, aujourdhui: date) -> None:
    if selection.date != aujourdhui:
        raise ValueError("Impossible de clôturer une sélection d'un autre jour")

    tache = selection.tache
    action = decision.action

    if action == "realiser":
        if selection.statut_jour == StatutJour.realise:
            raise ValueError("Cette tâche a déjà été marquée réalisée")
        selection.statut_jour = StatutJour.realise
        if tache.recurrente:
            # se régénère pour le lendemain, comme la veille qui se réalimente chaque jour
            tache.statut = StatutTache.a_realiser
            tache.date_fin = aujourdhui + timedelta(days=1)
        else:
            tache.statut = StatutTache.realise

    elif action == "annuler_realisation":
        # Rattrapage d'un clic "Réalisé" par erreur : remet la tâche dans le quota du
        # jour. Pour une tâche récurrente, tache.statut est déjà "a_realiser" (déjà
        # régénérée pour demain par l'action "realiser" ci-dessus) — on ne touche qu'à
        # la sélection du jour, pas à la tâche elle-même. date_fin en revanche doit
        # être restaurée : "realiser" l'avait avancée à J+1, sans quoi l'annulation
        # laisse une trace permanente d'un clic par erreur.
        if selection.statut_jour != StatutJour.realise:
            raise ValueError("Cette tâche n'est pas marquée réalisée")
        selection.statut_jour = StatutJour.en_attente
        if tache.recurrente:
            tache.date_fin = aujourdhui
        else:
            tache.statut = StatutTache.a_realiser
        # "realiser" a pu faire remonter une tâche suivante pour compenser la place
        # libérée (_completer_selection) ; sans compensation ici, le quota du jour
        # dépasse durablement MAX_TACHES après l'annulation. Pas de lien direct entre
        # une réalisation et la remontée qu'elle a déclenchée (pas de colonne dédiée) —
        # on retire la remontée automatique la plus récente encore en attente comme
        # approximation raisonnable, plutôt qu'un undo parfaitement précis.
        remontee = (
            db.query(SelectionJour)
            .filter_by(
                date=selection.date,
                contexte=selection.contexte,
                raison_selection=RaisonSelection.remontee_auto,
                statut_jour=StatutJour.en_attente,
            )
            .order_by(SelectionJour.id.desc())
            .first()
        )
        if remontee:
            db.delete(remontee)

    elif action == "reporter_demain":
        if selection.statut_jour != StatutJour.en_attente:
            raise ValueError("Cette tâche a déjà reçu une décision aujourd'hui")
        _reporter(db, tache, aujourdhui + timedelta(days=1))
        selection.statut_jour = StatutJour.reporte

    elif action == "reporter_date":
        if selection.statut_jour != StatutJour.en_attente:
            raise ValueError("Cette tâche a déjà reçu une décision aujourd'hui")
        if not decision.nouvelle_date:
            raise ValueError("nouvelle_date requise pour l'action reporter_date")
        _reporter(db, tache, decision.nouvelle_date)
        selection.statut_jour = StatutJour.reporte

    elif action == "abandonner":
        if selection.statut_jour != StatutJour.en_attente:
            raise ValueError("Cette tâche a déjà reçu une décision aujourd'hui")
        tache.statut = StatutTache.abandonne
        selection.statut_jour = StatutJour.abandonne

    elif action == "garder":
        if selection.statut_jour != StatutJour.en_attente:
            raise ValueError("Cette tâche a déjà reçu une décision aujourd'hui")
        selection.statut_jour = StatutJour.en_attente

    elif action == "reprioriser":
        if selection.statut_jour != StatutJour.en_attente:
            raise ValueError("Cette tâche a déjà reçu une décision aujourd'hui")
        if decision.nouvelle_priorite is None:
            raise ValueError("nouvelle_priorite requise pour l'action reprioriser")
        tache.priorite = decision.nouvelle_priorite
        selection.statut_jour = StatutJour.en_attente

    else:
        raise ValueError(f"action inconnue : {action}")

    tache.derniere_interaction = datetime.now()
    db.commit()

    if action == "realiser":
        _completer_selection(db, selection.contexte, selection.date)


def _completer_selection(db: Session, contexte: Contexte, jour: date) -> None:
    """Fait remonter automatiquement la tâche suivante quand une des tâches du jour est réalisée,
    pour garder jusqu'à MAX_TACHES tâches actives à traiter. Les tâches récurrentes ne comptent
    ni comme place occupée, ni comme candidate au remplissage : elles ont leur bloc dédié."""
    deja_ids = {s.tache_id for s in db.query(SelectionJour).filter_by(date=jour, contexte=contexte).all()}
    actives = (
        db.query(SelectionJour)
        .filter_by(date=jour, contexte=contexte, statut_jour=StatutJour.en_attente)
        .filter(SelectionJour.raison_selection != RaisonSelection.recurrente)
        .count()
    )
    places_libres = MAX_TACHES - actives
    if places_libres <= 0:
        return

    query = db.query(Tache).join(Tache.domaines).filter(
        Domaine.contexte.in_([contexte, Contexte.les_deux]), Tache.statut == StatutTache.a_realiser, Tache.recurrente.is_(False)
    )
    if deja_ids:
        query = query.filter(~Tache.id.in_(deja_ids))
    candidates = sorted(query.distinct().all(), key=lambda t: score(t, date.today()), reverse=True)

    for tache_suivante in candidates[:places_libres]:
        db.add(
            SelectionJour(
                date=jour,
                contexte=contexte,
                tache_id=tache_suivante.id,
                raison_selection=RaisonSelection.remontee_auto,
            )
        )
    db.commit()


def _reporter(db: Session, tache: Tache, nouvelle_date) -> None:
    ancienne = tache.date_fin
    tache.date_fin = nouvelle_date
    db.add(HistoriqueReport(tache_id=tache.id, ancienne_echeance=ancienne, nouvelle_echeance=nouvelle_date))
