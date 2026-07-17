"""Endpoints appelés par le workflow GitHub Actions planifié (pas par un utilisateur
connecté) — protégés par un secret partagé, pas une session JWT. Voir
app/services/securite.py:exiger_secret_planificateur et .github/workflows/."""

from typing import Literal

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
def declencher_notification(contexte: Contexte, evenement: Literal["ouverture", "cloture"], db: Session = Depends(get_db)):
    fonction = notifier_ouverture if evenement == "ouverture" else notifier_cloture
    envoye = fonction(db, contexte)
    return {"contexte": contexte, "evenement": evenement, "envoye": envoye}
