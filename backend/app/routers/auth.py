from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Utilisateur
from app.services.securite import creer_jeton_session, hacher_mot_de_passe, verifier_mot_de_passe

router = APIRouter(prefix="/auth", tags=["auth"])

SEUIL_TENTATIVES = 5
DUREE_VERROUILLAGE = timedelta(minutes=15)


class MotDePasseEntree(BaseModel):
    mot_de_passe: str


class SessionSortie(BaseModel):
    jeton: str


class StatutSortie(BaseModel):
    configure: bool


def _obtenir_utilisateur(db: Session) -> Optional[Utilisateur]:
    return db.query(Utilisateur).filter_by(id=1).first()


def _deja_configure(utilisateur: Optional[Utilisateur]) -> bool:
    return bool(utilisateur and (utilisateur.mot_de_passe_hash or utilisateur.identifiants_webauthn))


@router.get("/status", response_model=StatutSortie)
def statut(db: Session = Depends(get_db)):
    return StatutSortie(configure=_deja_configure(_obtenir_utilisateur(db)))


@router.post("/setup-mot-de-passe", response_model=SessionSortie, status_code=201)
def configurer_mot_de_passe(entree: MotDePasseEntree, db: Session = Depends(get_db)):
    utilisateur = _obtenir_utilisateur(db)
    if _deja_configure(utilisateur):
        raise HTTPException(status_code=409, detail="Un mode de connexion est déjà configuré")
    if len(entree.mot_de_passe) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères")

    if not utilisateur:
        utilisateur = Utilisateur(id=1)
        db.add(utilisateur)
    utilisateur.mot_de_passe_hash = hacher_mot_de_passe(entree.mot_de_passe)
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(utilisateur.id))


@router.post("/login", response_model=SessionSortie)
def se_connecter(entree: MotDePasseEntree, db: Session = Depends(get_db)):
    utilisateur = _obtenir_utilisateur(db)
    if not utilisateur or not utilisateur.mot_de_passe_hash:
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    maintenant = datetime.now()
    if utilisateur.verrouille_jusqu_a and utilisateur.verrouille_jusqu_a > maintenant:
        minutes_restantes = int((utilisateur.verrouille_jusqu_a - maintenant).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=429, detail=f"Trop de tentatives échouées. Réessaie dans {minutes_restantes} min."
        )

    if not verifier_mot_de_passe(entree.mot_de_passe, utilisateur.mot_de_passe_hash):
        utilisateur.tentatives_echouees += 1
        if utilisateur.tentatives_echouees >= SEUIL_TENTATIVES:
            utilisateur.verrouille_jusqu_a = maintenant + DUREE_VERROUILLAGE
            utilisateur.tentatives_echouees = 0
        db.commit()
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    utilisateur.tentatives_echouees = 0
    utilisateur.verrouille_jusqu_a = None
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(utilisateur.id))
