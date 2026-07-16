from datetime import date, timedelta

from app.models import Priorite, Tache

POIDS_PRIORITE = {
    Priorite.un_jour: 1,
    Priorite.cette_semaine: 2,
    Priorite.aujourd_hui: 3,
}


def fenetre_preparation_active(tache: Tache, aujourdhui: date) -> bool:
    """Vrai si la tâche est dans sa fenêtre de préparation avant un événement fixe."""
    if not (tache.date_evenement and tache.delai_preparation_jours is not None):
        return False
    seuil = tache.date_evenement - timedelta(days=tache.delai_preparation_jours)
    return seuil <= aujourdhui < tache.date_evenement


def urgence(tache: Tache, aujourdhui: date) -> float:
    """Urgence croissante à mesure que l'échéance approche. Sans échéance, urgence basse et stable."""
    if fenetre_preparation_active(tache, aujourdhui):
        jours_restants = max((tache.date_evenement - aujourdhui).days, 1)
        return 10 / jours_restants

    if tache.date_fin is None:
        return 1.0

    jours_restants = (tache.date_fin - aujourdhui).days
    if jours_restants <= 0:
        return 10.0
    return 10 / jours_restants


def score(tache: Tache, aujourdhui: date) -> float:
    return POIDS_PRIORITE[tache.priorite] * urgence(tache, aujourdhui)
