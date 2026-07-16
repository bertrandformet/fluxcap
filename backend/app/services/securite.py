"""Hashage du mot de passe (PBKDF2, stdlib uniquement — pas de dépendance binaire
supplémentaire) et émission/vérification des sessions JWT."""

import base64
import hashlib
import hmac
import secrets
import time
from typing import Optional

import jwt
from fastapi import Header, HTTPException

from app.config import SECRET_KEY

ITERATIONS = 600_000
DUREE_SESSION_SECONDES = 30 * 24 * 3600  # 30 jours


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


def creer_jeton_session(utilisateur_id: int) -> str:
    maintenant = int(time.time())
    return jwt.encode(
        {"sub": str(utilisateur_id), "iat": maintenant, "exp": maintenant + DUREE_SESSION_SECONDES},
        SECRET_KEY,
        algorithm="HS256",
    )


def lire_jeton_session(jeton: str) -> Optional[int]:
    try:
        charge = jwt.decode(jeton, SECRET_KEY, algorithms=["HS256"])
        return int(charge["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def exiger_authentification(authorization: Optional[str] = Header(None)) -> int:
    """Dépendance FastAPI : vérifie le Bearer token, appliquée à tous les routers
    protégés via include_router(..., dependencies=[Depends(exiger_authentification)])."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentification requise")
    utilisateur_id = lire_jeton_session(authorization[len("Bearer "):])
    if utilisateur_id is None:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    return utilisateur_id
