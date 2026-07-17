"""Hashage du mot de passe (PBKDF2, stdlib uniquement — pas de dépendance binaire
supplémentaire) et émission/vérification des sessions JWT."""

import base64
import hashlib
import hmac
import secrets
import time
from typing import Optional, Tuple

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import SCHEDULER_SECRET, SECRET_KEY
from app.database import get_db
from app.models import Utilisateur

ITERATIONS = 600_000
DUREE_SESSION_SECONDES = 30 * 24 * 3600  # 30 jours

# Sans 0/O, 1/I/L, U : évite les confusions à la recopie manuelle.
ALPHABET_RECUPERATION = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
LONGUEUR_CODE_RECUPERATION = 16  # ~80 bits d'entropie, largement hors de portée d'un bruteforce réseau


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    sel = secrets.token_bytes(16)
    derive = hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode("utf-8"), sel, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${base64.b64encode(sel).decode()}${base64.b64encode(derive).decode()}"


def verifier_mot_de_passe(mot_de_passe: str, hash_stocke: str) -> bool:
    try:
        algo, iterations_str, sel_b64, derive_b64 = hash_stocke.split("$")
        if algo != "pbkdf2_sha256":
            return False
        sel = base64.b64decode(sel_b64)
        attendu = base64.b64decode(derive_b64)
    except (ValueError, TypeError):
        return False
    calcule = hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode("utf-8"), sel, int(iterations_str))
    return hmac.compare_digest(calcule, attendu)


def generer_code_recuperation() -> str:
    """Code canonique (sans tirets, majuscules) — voir formater_code_recuperation pour l'affichage."""
    return "".join(secrets.choice(ALPHABET_RECUPERATION) for _ in range(LONGUEUR_CODE_RECUPERATION))


def formater_code_recuperation(code: str) -> str:
    return "-".join(code[i : i + 4] for i in range(0, len(code), 4))


def normaliser_code_recuperation(code: str) -> str:
    return "".join(c for c in code.upper() if c in ALPHABET_RECUPERATION)


def generer_cle_api() -> str:
    """Clé longue durée pour raccourcis/scripts externes — ~256 bits d'entropie, donc un
    simple hash rapide suffit à la stocker (pas besoin du ralentissement PBKDF2, réservé
    aux secrets à entropie faible comme un mot de passe choisi par l'utilisateur)."""
    return "fxc_" + secrets.token_urlsafe(32)


def hacher_cle_api(cle: str) -> str:
    return hashlib.sha256(cle.encode("utf-8")).hexdigest()


def verifier_cle_api(cle: str, hash_stocke: str) -> bool:
    return hmac.compare_digest(hacher_cle_api(cle), hash_stocke)


def creer_jeton_session(utilisateur_id: int, version_session: int) -> str:
    maintenant = int(time.time())
    return jwt.encode(
        {"sub": str(utilisateur_id), "ver": version_session, "iat": maintenant, "exp": maintenant + DUREE_SESSION_SECONDES},
        SECRET_KEY,
        algorithm="HS256",
    )


def lire_jeton_session(jeton: str) -> Optional[Tuple[int, int]]:
    """Retourne (utilisateur_id, version_session) porté par le jeton, ou None s'il est
    invalide/expiré. La version doit ensuite être comparée à celle en base (voir
    exiger_authentification) pour détecter un jeton révoqué via "déconnecter partout"."""
    try:
        charge = jwt.decode(jeton, SECRET_KEY, algorithms=["HS256"])
        return int(charge["sub"]), int(charge["ver"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def exiger_authentification(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> int:
    """Dépendance FastAPI : accepte soit un jeton de session JWT valide (version non
    révoquée), soit la clé API longue durée (raccourcis externes) — appliquée à tous les
    routers protégés via include_router(..., dependencies=[Depends(exiger_authentification)])."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentification requise")
    jeton = authorization[len("Bearer "):]

    charge = lire_jeton_session(jeton)
    if charge is not None:
        utilisateur_id, version_jeton = charge
        utilisateur = db.query(Utilisateur).filter_by(id=utilisateur_id).first()
        if utilisateur and utilisateur.session_version == version_jeton:
            return utilisateur_id

    utilisateur = db.query(Utilisateur).filter_by(id=1).first()
    if utilisateur and utilisateur.cle_api_hash and verifier_cle_api(jeton, utilisateur.cle_api_hash):
        return utilisateur.id

    raise HTTPException(status_code=401, detail="Session invalide ou expirée")


def exiger_secret_planificateur(x_scheduler_secret: Optional[str] = Header(None)) -> None:
    """Dépendance pour les endpoints appelés sans utilisateur connecté (GitHub Actions
    planifié) : un secret partagé statique via l'en-tête X-Scheduler-Secret, distinct
    des sessions JWT utilisateur."""
    if not SCHEDULER_SECRET or not x_scheduler_secret or not hmac.compare_digest(x_scheduler_secret, SCHEDULER_SECRET):
        raise HTTPException(status_code=401, detail="Secret de planification invalide")
