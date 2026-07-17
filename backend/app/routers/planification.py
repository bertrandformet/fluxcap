"""Endpoints appelés par le workflow GitHub Actions planifié (pas par un utilisateur
connecté) — protégés par un secret partagé, pas une session JWT. Voir
app/services/securite.py:exiger_secret_planificateur et .github/workflows/."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contexte
from app.services.ingestion_veille import ingerer_contexte
from app.services.notification_email import notifier_cloture, notifier_ouverture

router = APIRouter(prefix="/planification", tags=["planification"])


@router.post("/veille/{contexte}")
def declencher_ingestion_veille(contexte: Contexte, db: Session = Depends(get_db)):
    nouveaux = ingerer_contexte(db, contexte)
    return {"contexte": contexte, "nouveaux_items": nouveaux}


@router.post("/notification/{contexte}/{evenement}")
def declencher_notification(
    contexte: Contexte,
    evenement: Literal["ouverture", "cloture"],
    creneau: Optional[Literal["semaine", "weekend"]] = None,
    db: Session = Depends(get_db),
):
    """`creneau` distingue, pour Perso uniquement, l'appel du rythme semaine (21h/7h) de
    celui du rythme week-end (9h/21h) — les deux sont désormais déclenchés tous les jours
    par le workflow planifié, et c'est ici que le bon rythme du jour (vrai week-end, ou
    n'importe quel jour en congés) est choisi. Voir app/services/notification_email.py."""
    fonction = notifier_ouverture if evenement == "ouverture" else notifier_cloture
    envoye = fonction(db, contexte, creneau)
    return {"contexte": contexte, "evenement": evenement, "creneau": creneau, "envoye": envoye}
