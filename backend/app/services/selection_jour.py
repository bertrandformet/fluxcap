from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

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


def obtenir_ou_construire_selection(db: Session, contexte: Contexte, aujourdhui: date) -> list[SelectionJour]:
    existantes = db.query(SelectionJour).filter_by(date=aujourdhui, contexte=contexte).all()
    if existantes:
        return existantes
    return _construire_selection(db, contexte, aujourdhui)


def _construire_selection(db: Session, contexte: Contexte, aujourdhui: date) -> list[SelectionJour]:
    toutes_eligibles = (
        db.query(Tache)
        .join(Domaine)
        .filter(Domaine.contexte == contexte, Tache.statut == StatutTache.a_realiser)
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

    # 2. reportées hier lors de la clôture précédente
    hier = aujourdhui - timedelta(days=1)
    for t in taches_eligibles:
        if t.id in retenues or not t.historique_reports:
            continue
        dernier_report = max(t.historique_reports, key=lambda r: r.date_evenement)
        if dernier_report.date_evenement.date() == hier:
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
                candidats_score = [tid for tid, raison in retenues.items() if raison == RaisonSelection.score]
                if candidats_score:
                    moins_prioritaire = min(candidats_score, key=lambda tid: score(par_id[tid], aujourdhui))
                    del retenues[moins_prioritaire]
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
    for ligne in lignes:
        db.refresh(ligne)
    return lignes


def appliquer_decision(db: Session, selection: SelectionJour, decision: DecisionAction, aujourdhui: date) -> None:
    tache = selection.tache
    action = decision.action

    if action == "realiser":
        selection.statut_jour = StatutJour.realise
        if tache.recurrente:
            # se régénère pour le lendemain, comme la veille qui se réalimente chaque jour
            tache.statut = StatutTache.a_realiser
            tache.date_fin = aujourdhui + timedelta(days=1)
        else:
            tache.statut = StatutTache.realise

    elif action == "reporter_demain":
        _reporter(db, tache, aujourdhui + timedelta(days=1))
        selection.statut_jour = StatutJour.reporte

    elif action == "reporter_date":
        if not decision.nouvelle_date:
            raise ValueError("nouvelle_date requise pour l'action reporter_date")
        _reporter(db, tache, decision.nouvelle_date)
        selection.statut_jour = StatutJour.reporte

    elif action == "abandonner":
        tache.statut = StatutTache.abandonne
        selection.statut_jour = StatutJour.abandonne

    elif action == "garder":
        selection.statut_jour = StatutJour.en_attente

    elif action == "reprioriser":
        if decision.nouvelle_priorite is None:
            raise ValueError("nouvelle_priorite requise pour l'action reprioriser")
        tache.priorite = decision.nouvelle_priorite
        selection.statut_jour = StatutJour.en_attente

    else:
        raise ValueError(f"action inconnue : {action}")

    tache.derniere_interaction = datetime.utcnow()
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

    query = db.query(Tache).join(Domaine).filter(
        Domaine.contexte == contexte, Tache.statut == StatutTache.a_realiser, Tache.recurrente.is_(False)
    )
    if deja_ids:
        query = query.filter(~Tache.id.in_(deja_ids))
    candidates = sorted(query.all(), key=lambda t: score(t, date.today()), reverse=True)

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
