"""Stockage des pièces jointes : disque local par défaut (dev), ou bucket Supabase
Storage si SUPABASE_URL/SUPABASE_SERVICE_KEY sont renseignés (prod, Render en plan
gratuit dont le disque n'est pas persistant)."""

from typing import Optional

from app.config import SUPABASE_BUCKET, SUPABASE_SERVICE_KEY, SUPABASE_URL, UPLOAD_DIR

_client = None


def _supabase_configure() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def _client_supabase():
    global _client
    if _client is None:
        from supabase import create_client

        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def sauvegarder(nom_stocke: str, contenu: bytes, type_mime: Optional[str]) -> None:
    if _supabase_configure():
        _client_supabase().storage.from_(SUPABASE_BUCKET).upload(
            nom_stocke, contenu, {"content-type": type_mime or "application/octet-stream"}
        )
    else:
        (UPLOAD_DIR / nom_stocke).write_bytes(contenu)


def lire(nom_stocke: str) -> Optional[bytes]:
    if _supabase_configure():
        try:
            return _client_supabase().storage.from_(SUPABASE_BUCKET).download(nom_stocke)
        except Exception:
            return None
    chemin = UPLOAD_DIR / nom_stocke
    return chemin.read_bytes() if chemin.exists() else None


def supprimer(nom_stocke: str) -> None:
    if _supabase_configure():
        try:
            _client_supabase().storage.from_(SUPABASE_BUCKET).remove([nom_stocke])
        except Exception:
            pass
        return
    chemin = UPLOAD_DIR / nom_stocke
    if chemin.exists():
        chemin.unlink()
