import base64
import json
from datetime import datetime, timedelta
from typing import List, Optional

import webauthn
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement

from app.config import WEBAUTHN_ORIGIN, WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME
from app.database import get_db
from app.models import DefiWebauthn, IdentifiantWebauthn, Utilisateur
from app.services.securite import (
    creer_jeton_session,
    formater_code_recuperation,
    generer_code_recuperation,
    hacher_mot_de_passe,
    lire_jeton_session,
    normaliser_code_recuperation,
    verifier_mot_de_passe,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SEUIL_TENTATIVES = 5
DUREE_VERROUILLAGE = timedelta(minutes=15)
DUREE_VALIDITE_DEFI = timedelta(minutes=5)


class MotDePasseEntree(BaseModel):
    mot_de_passe: str


class SessionSortie(BaseModel):
    jeton: str
    code_recuperation: Optional[str] = None


class RecuperationEntree(BaseModel):
    code: str
    nouveau_mot_de_passe: str


class StatutSortie(BaseModel):
    configure: bool
    webauthn_disponible: bool


class InscriptionWebauthnEntree(BaseModel):
    nom: str


class VerifierInscriptionEntree(BaseModel):
    nom: str
    credential: dict


class VerifierAuthentificationEntree(BaseModel):
    credential: dict


class IdentifiantWebauthnSortie(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nom: str
    cree_le: datetime


def _obtenir_utilisateur(db: Session) -> Optional[Utilisateur]:
    return db.query(Utilisateur).filter_by(id=1).first()


def _deja_configure(utilisateur: Optional[Utilisateur]) -> bool:
    return bool(utilisateur and (utilisateur.mot_de_passe_hash or utilisateur.identifiants_webauthn))


def _utilisateur_authentifie(authorization: Optional[str], db: Session) -> Utilisateur:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentification requise")
    utilisateur_id = lire_jeton_session(authorization[len("Bearer "):])
    utilisateur = _obtenir_utilisateur(db)
    if utilisateur_id is None or not utilisateur or utilisateur_id != utilisateur.id:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    return utilisateur


def _utilisateur_pour_inscription(authorization: Optional[str], db: Session) -> Utilisateur:
    """Autorise l'inscription d'une clé sans session valide uniquement si aucun mode de
    connexion n'existe encore (premier réglage) ; sinon exige d'être déjà connecté, pour
    empêcher n'importe qui d'ajouter sa propre clé sur le compte."""
    utilisateur = _obtenir_utilisateur(db)
    if _deja_configure(utilisateur):
        return _utilisateur_authentifie(authorization, db)
    if not utilisateur:
        utilisateur = Utilisateur(id=1)
        db.add(utilisateur)
        db.flush()
    return utilisateur


def _generer_code_recuperation(utilisateur: Utilisateur) -> str:
    code = generer_code_recuperation()
    utilisateur.code_recuperation_hash = hacher_mot_de_passe(code)
    return formater_code_recuperation(code)


def _stocker_defi(db: Session, defi: bytes, type_defi: str) -> None:
    db.query(DefiWebauthn).filter(DefiWebauthn.type == type_defi).delete()
    db.add(DefiWebauthn(defi=bytes_to_base64url(defi), type=type_defi))
    db.commit()


def _consommer_defi(db: Session, type_defi: str) -> bytes:
    ligne = db.query(DefiWebauthn).filter(DefiWebauthn.type == type_defi).order_by(DefiWebauthn.id.desc()).first()
    if not ligne or (datetime.utcnow() - ligne.cree_le) > DUREE_VALIDITE_DEFI:
        raise HTTPException(status_code=400, detail="Défi expiré ou introuvable, réessaie")
    db.delete(ligne)
    db.commit()
    return base64url_to_bytes(ligne.defi)


@router.get("/status", response_model=StatutSortie)
def statut(db: Session = Depends(get_db)):
    utilisateur = _obtenir_utilisateur(db)
    return StatutSortie(
        configure=_deja_configure(utilisateur),
        webauthn_disponible=bool(utilisateur and utilisateur.identifiants_webauthn),
    )


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
    code_recuperation = _generer_code_recuperation(utilisateur)
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(utilisateur.id), code_recuperation=code_recuperation)


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


@router.post("/recuperer", response_model=SessionSortie)
def recuperer_compte(entree: RecuperationEntree, db: Session = Depends(get_db)):
    """Réinitialise le mot de passe avec le code de récupération à usage unique affiché
    au premier réglage. Pas de limitation de débit dédiée : le code a ~80 bits d'entropie,
    un bruteforce réseau est hors de portée."""
    utilisateur = _obtenir_utilisateur(db)
    if not utilisateur or not utilisateur.code_recuperation_hash:
        raise HTTPException(status_code=401, detail="Code de récupération invalide")
    if not verifier_mot_de_passe(normaliser_code_recuperation(entree.code), utilisateur.code_recuperation_hash):
        raise HTTPException(status_code=401, detail="Code de récupération invalide")
    if len(entree.nouveau_mot_de_passe) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères")

    utilisateur.mot_de_passe_hash = hacher_mot_de_passe(entree.nouveau_mot_de_passe)
    utilisateur.tentatives_echouees = 0
    utilisateur.verrouille_jusqu_a = None
    code_recuperation = _generer_code_recuperation(utilisateur)
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(utilisateur.id), code_recuperation=code_recuperation)


# --- WebAuthn (Face ID / Touch ID / clé de sécurité) ---


@router.post("/webauthn/inscription/options")
def options_inscription(
    entree: InscriptionWebauthnEntree, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)
):
    utilisateur = _utilisateur_pour_inscription(authorization, db)
    exclure = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(i.credential_id))
        for i in utilisateur.identifiants_webauthn
    ]
    options = webauthn.generate_registration_options(
        rp_id=WEBAUTHN_RP_ID,
        rp_name=WEBAUTHN_RP_NAME,
        user_id=str(utilisateur.id).encode(),
        user_name="proprietaire",
        user_display_name=entree.nom,
        exclude_credentials=exclure,
    )
    _stocker_defi(db, options.challenge, "inscription")
    return json.loads(webauthn.options_to_json(options))


@router.post("/webauthn/inscription/verifier", response_model=SessionSortie, status_code=201)
def verifier_inscription(
    entree: VerifierInscriptionEntree, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)
):
    utilisateur = _utilisateur_pour_inscription(authorization, db)
    premiere_configuration = not _deja_configure(utilisateur)
    defi = _consommer_defi(db, "inscription")
    try:
        verification = webauthn.verify_registration_response(
            credential=entree.credential,
            expected_challenge=defi,
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Échec de la vérification de la clé")

    db.add(
        IdentifiantWebauthn(
            utilisateur_id=utilisateur.id,
            nom=entree.nom,
            credential_id=bytes_to_base64url(verification.credential_id),
            cle_publique=base64.b64encode(verification.credential_public_key).decode(),
            compteur_signature=verification.sign_count,
        )
    )
    code_recuperation = _generer_code_recuperation(utilisateur) if premiere_configuration else None
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(utilisateur.id), code_recuperation=code_recuperation)


@router.post("/webauthn/authentification/options")
def options_authentification(db: Session = Depends(get_db)):
    utilisateur = _obtenir_utilisateur(db)
    autoriser = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(i.credential_id))
        for i in (utilisateur.identifiants_webauthn if utilisateur else [])
    ]
    options = webauthn.generate_authentication_options(
        rp_id=WEBAUTHN_RP_ID, allow_credentials=autoriser, user_verification=UserVerificationRequirement.PREFERRED
    )
    _stocker_defi(db, options.challenge, "authentification")
    return json.loads(webauthn.options_to_json(options))


@router.post("/webauthn/authentification/verifier", response_model=SessionSortie)
def verifier_authentification(entree: VerifierAuthentificationEntree, db: Session = Depends(get_db)):
    defi = _consommer_defi(db, "authentification")
    credential_id_recu = entree.credential.get("id")
    identifiant = (
        db.query(IdentifiantWebauthn).filter(IdentifiantWebauthn.credential_id == credential_id_recu).first()
        if credential_id_recu
        else None
    )
    if not identifiant:
        raise HTTPException(status_code=401, detail="Clé inconnue")

    try:
        verification = webauthn.verify_authentication_response(
            credential=entree.credential,
            expected_challenge=defi,
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
            credential_public_key=base64.b64decode(identifiant.cle_publique),
            credential_current_sign_count=identifiant.compteur_signature,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Échec de l'authentification")

    identifiant.compteur_signature = verification.new_sign_count
    db.commit()
    return SessionSortie(jeton=creer_jeton_session(identifiant.utilisateur_id))


@router.get("/webauthn/identifiants", response_model=List[IdentifiantWebauthnSortie])
def lister_identifiants(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    utilisateur = _utilisateur_authentifie(authorization, db)
    return utilisateur.identifiants_webauthn


@router.delete("/webauthn/identifiants/{identifiant_id}", status_code=204)
def supprimer_identifiant(
    identifiant_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)
):
    utilisateur = _utilisateur_authentifie(authorization, db)
    identifiant = db.get(IdentifiantWebauthn, identifiant_id)
    if not identifiant or identifiant.utilisateur_id != utilisateur.id:
        raise HTTPException(status_code=404, detail="Clé introuvable")
    db.delete(identifiant)
    db.commit()
