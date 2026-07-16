import ipaddress
import re
import socket
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.database import get_db
from app.models import Note, PieceJointe, Priorite, Tache
from app.schemas import NoteCreate, NoteOut, NoteUpdate, PieceJointeOut, TacheOut
from app.services import stockage
from app.services.export_notes import GENERATEURS

router = APIRouter(prefix="/notes", tags=["notes"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_TAILLE_OCTETS = 10 * 1024 * 1024  # 10 Mo


@router.get("", response_model=list[NoteOut])
def lister_notes(domaine_id: Optional[int] = None, sans_tag: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(Note)
    if sans_tag:
        query = query.filter(Note.domaine_id.is_(None))
    elif domaine_id:
        query = query.filter(Note.domaine_id == domaine_id)
    return query.order_by(Note.cree_le.desc()).all()


class _SansRedirection(urllib.request.HTTPRedirectHandler):
    """Bloque les redirections HTTP : une cible autorisée pourrait rediriger vers
    une adresse interne, ce qui contournerait la vérification faite avant la requête."""

    def redirect_request(self, *args, **kwargs):
        return None


def _hote_public(hostname: str) -> bool:
    """Refuse les hôtes qui résolvent vers une IP privée, loopback, lien-local ou réservée
    (ex. 169.254.169.254, métadonnées cloud), pour empêcher le serveur d'être utilisé comme proxy SSRF."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            return False
    return True


def _url_apercu_autorisee(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    if not parsed.hostname:
        return False
    return _hote_public(parsed.hostname)


@router.get("/apercu-lien")
def apercu_lien(url: str):
    """Récupère titre et description d'une page pour préremplir l'import manuel d'un lien."""
    if not _url_apercu_autorisee(url):
        return {"titre": "", "apercu": ""}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        opener = urllib.request.build_opener(_SansRedirection)
        with opener.open(req, timeout=5) as resp:
            html = resp.read(200_000).decode("utf-8", errors="ignore")
    except (URLError, ValueError, TimeoutError, OSError):
        return {"titre": "", "apercu": ""}

    titre_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    desc_match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE
    )
    return {
        "titre": titre_match.group(1).strip() if titre_match else "",
        "apercu": desc_match.group(1).strip() if desc_match else "",
    }


@router.post("", response_model=NoteOut, status_code=201)
def creer_note(note: NoteCreate, db: Session = Depends(get_db)):
    obj = Note(**note.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{note_id}", response_model=NoteOut)
def modifier_note(note_id: int, note: NoteUpdate, db: Session = Depends(get_db)):
    obj = db.get(Note, note_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Note introuvable")
    for champ, valeur in note.model_dump(exclude_unset=True).items():
        setattr(obj, champ, valeur)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{note_id}", status_code=204)
def supprimer_note(note_id: int, db: Session = Depends(get_db)):
    obj = db.get(Note, note_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Note introuvable")
    for piece in obj.pieces_jointes:
        stockage.supprimer(piece.nom_stocke)
    db.delete(obj)
    db.commit()


@router.post("/{note_id}/transformer-tache", response_model=TacheOut, status_code=201)
def transformer_en_tache(note_id: int, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if not note.domaine_id:
        raise HTTPException(
            status_code=400, detail="La note doit avoir un tag de domaine pour être transformée en tâche"
        )
    tache = Tache(
        titre=note.titre,
        domaine_id=note.domaine_id,
        description=note.contenu or note.apercu,
        priorite=Priorite.un_jour,
        derniere_interaction=datetime.now(),
    )
    db.add(tache)
    db.commit()
    db.refresh(tache)
    return tache


@router.get("/{note_id}/export")
def exporter_note(note_id: int, format: str = "md", db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if format not in GENERATEURS:
        raise HTTPException(status_code=400, detail="Format d'export inconnu (txt, md, docx)")

    generateur, media_type = GENERATEURS[format]
    contenu = generateur(note)
    nom_fichier = re.sub(r"[^\w\-]+", "_", note.titre).strip("_") or "note"
    return Response(
        content=contenu,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}.{format}"'},
    )


@router.post("/{note_id}/pieces-jointes", response_model=PieceJointeOut, status_code=201)
async def ajouter_piece_jointe(note_id: int, fichier: UploadFile = File(...), db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")

    contenu = await fichier.read()
    if len(contenu) > MAX_TAILLE_OCTETS:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")

    extension = Path(fichier.filename or "").suffix
    nom_stocke = f"{uuid.uuid4().hex}{extension}"
    stockage.sauvegarder(nom_stocke, contenu, fichier.content_type)

    piece = PieceJointe(
        note_id=note_id,
        nom_original=fichier.filename or nom_stocke,
        nom_stocke=nom_stocke,
        type_mime=fichier.content_type,
        taille_octets=len(contenu),
    )
    db.add(piece)
    db.commit()
    db.refresh(piece)
    return piece


@router.get("/pieces-jointes/{piece_id}/fichier")
def telecharger_piece_jointe(piece_id: int, db: Session = Depends(get_db)):
    piece = db.get(PieceJointe, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce jointe introuvable")
    contenu = stockage.lire(piece.nom_stocke)
    if contenu is None:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return Response(
        content=contenu,
        media_type=piece.type_mime or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{piece.nom_original}"'},
    )


@router.delete("/pieces-jointes/{piece_id}", status_code=204)
def supprimer_piece_jointe(piece_id: int, db: Session = Depends(get_db)):
    piece = db.get(PieceJointe, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce jointe introuvable")
    stockage.supprimer(piece.nom_stocke)
    db.delete(piece)
    db.commit()
