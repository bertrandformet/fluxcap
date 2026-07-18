"""Peuple la base avec des données factices pour le développement du POC.

Aucun nom de domaine réel n'est utilisé ici : les domaines sont entièrement
gérables depuis l'application, ce script sert uniquement à illustrer le
fonctionnement (score, épinglage, report remonté, anti-oubli, veille, notes,
multi-domaines).
"""

from datetime import date, datetime, timedelta

from app.database import Base, SessionLocal, engine
from app.models import (
    Contexte,
    Domaine,
    HistoriqueReport,
    Note,
    Priorite,
    SourceNote,
    Tache,
    VeilleItem,
)


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        aujourdhui = date.today()
        hier = aujourdhui - timedelta(days=1)

        domaine_a = Domaine(nom="Domaine Pro A", contexte=Contexte.pro)
        domaine_b = Domaine(nom="Domaine Pro B", contexte=Contexte.pro)
        domaine_c = Domaine(nom="Domaine Pro C", contexte=Contexte.pro)
        domaine_perso = Domaine(nom="Domaine Perso A", contexte=Contexte.perso)
        db.add_all([domaine_a, domaine_b, domaine_c, domaine_perso])
        db.flush()

        taches = [
            Tache(
                titre="Préparer le comité de pilotage",
                priorite=Priorite.aujourd_hui,
                date_fin=aujourdhui + timedelta(days=1),
            ),
            Tache(
                titre="Relire le rapport trimestriel",
                priorite=Priorite.cette_semaine,
                date_fin=aujourdhui + timedelta(days=3),
            ),
            Tache(
                titre="Répondre aux mels en attente",
                type="administrative",
                priorite=Priorite.aujourd_hui,
                recurrente=True,
                date_fin=aujourdhui,
            ),
            Tache(
                titre="Mettre à jour le tableau de suivi budgétaire",
                type="administrative",
                priorite=Priorite.un_jour,
                date_fin=aujourdhui + timedelta(days=10),
            ),
            Tache(
                # Exemple multi-domaines : concerne à la fois le Domaine Pro C et le Domaine Pro A.
                titre="Organiser un point d'équipe",
                priorite=Priorite.cette_semaine,
                date_fin=aujourdhui + timedelta(days=5),
                epinglee=True,
            ),
            Tache(
                titre="Préparer la formation X",
                priorite=Priorite.cette_semaine,
                date_evenement=aujourdhui + timedelta(days=4),
                delai_preparation_jours=5,
            ),
            Tache(
                titre="Nettoyer les archives partagées",
                priorite=Priorite.un_jour,
                derniere_interaction=datetime.utcnow() - timedelta(days=20),
            ),
            Tache(
                titre="Ranger le bureau",
                priorite=Priorite.un_jour,
                date_fin=aujourdhui + timedelta(days=2),
            ),
            Tache(
                titre="Planifier les vacances d'été",
                priorite=Priorite.cette_semaine,
                date_fin=aujourdhui + timedelta(days=14),
            ),
            Tache(
                titre="Trier la bibliothèque de livres",
                priorite=Priorite.un_jour,
                derniere_interaction=datetime.utcnow() - timedelta(days=15),
            ),
            Tache(
                titre="Payer la facture d'électricité",
                priorite=Priorite.aujourd_hui,
                date_fin=aujourdhui,
            ),
        ]
        taches[0].domaines = [domaine_a]
        taches[1].domaines = [domaine_a]
        taches[2].domaines = [domaine_b]
        taches[3].domaines = [domaine_b]
        taches[4].domaines = [domaine_c, domaine_a]
        taches[5].domaines = [domaine_c]
        taches[6].domaines = [domaine_a]
        taches[7].domaines = [domaine_perso]
        taches[8].domaines = [domaine_perso]
        taches[9].domaines = [domaine_perso]
        taches[10].domaines = [domaine_perso]
        db.add_all(taches)
        db.flush()

        # Tâche reportée hier lors de la clôture : doit remonter en premier aujourd'hui
        tache_reportee = Tache(
            titre="Finaliser la note de cadrage",
            priorite=Priorite.cette_semaine,
            date_fin=aujourdhui,
        )
        tache_reportee.domaines = [domaine_b]
        db.add(tache_reportee)
        db.flush()
        db.add(
            HistoriqueReport(
                tache_id=tache_reportee.id,
                date_evenement=datetime.combine(hier, datetime.min.time()),
                ancienne_echeance=hier,
                nouvelle_echeance=aujourdhui,
                raison="reporté lors de la clôture",
            )
        )

        veille_items = [
            VeilleItem(
                titre="Nouvelle méthodologie agile pour les équipes distribuées",
                url="https://example.org/veille/agile-distribue",
                apercu="Retour sur une expérimentation menée dans trois équipes réparties sur plusieurs sites : "
                "rituels adaptés au distanciel, cadence de synchronisation réduite et outils partagés.",
                source="Flux Pro",
                date_publication=datetime.utcnow() - timedelta(days=2),
            ),
            VeilleItem(
                titre="Retour d'expérience sur un projet interne",
                url="https://example.org/veille/retex-projet",
                apercu="Bilan à froid d'un projet mené sur six mois : ce qui a bien fonctionné, les points de "
                "friction avec les parties prenantes et les ajustements recommandés pour la suite.",
                source="Flux Pro",
                date_publication=datetime.utcnow() - timedelta(days=5),
            ),
            VeilleItem(
                # Exemple multi-domaines : pertinent pour deux domaines Pro à la fois. Pas de
                # date_publication : simule un flux qui n'expose pas de date d'origine, pour
                # vérifier le repli sur date_ingestion à l'affichage.
                titre="Publication sur l'IA générative en administration",
                url="https://example.org/veille/ia-generative-admin",
                apercu="Panorama des usages émergents de l'IA générative dans les services publics, avec un focus "
                "sur les enjeux de cadrage juridique et d'acceptabilité par les agents.",
                source="Flux Pro",
            ),
            VeilleItem(
                titre="Article sur la gestion du temps",
                url="https://example.org/veille/gestion-du-temps",
                apercu="Synthèse de plusieurs études sur les techniques de blocage de temps et leurs limites, "
                "avec des pistes concrètes pour réduire la fragmentation de l'attention.",
                source="Flux Perso",
                date_publication=datetime.utcnow() - timedelta(days=1),
            ),
        ]
        veille_items[0].domaines = [domaine_a]
        veille_items[1].domaines = [domaine_b]
        veille_items[2].domaines = [domaine_c, domaine_b]
        veille_items[3].domaines = [domaine_perso]
        db.add_all(veille_items)

        # Pas de sources de veille pré-configurées : ajoutées à la main depuis l'écran Veille.

        notes = [
            Note(
                titre="Idée d'article de blog",
                apercu="Explorer le sujet des rituels quotidiens et de la charge mentale.",
                source=SourceNote.manuel,
            ),
            Note(
                # Exemple multi-domaines.
                titre="Comparatif d'outils de productivité",
                url="https://example.org/notes/comparatif-outils",
                apercu="Comparatif de plusieurs outils testés l'an dernier.",
                source=SourceNote.veille,
            ),
        ]
        notes[0].domaines = [domaine_perso]
        notes[1].domaines = [domaine_a, domaine_b]
        db.add_all(notes)

        db.commit()
        print("Base peuplée avec des données factices.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
