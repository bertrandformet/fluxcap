import functools
import html
import http.client
import ipaddress
import re
import socket
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
from urllib.error import URLError
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.config import UPLOAD_DIR
from app.database import get_db
from app.models import Contexte, Domaine, Note, PieceJointe, Priorite, SourceNote, Tache, VeilleItem
from app.schemas import FusionNotesPayload, NoteCreate, NoteOut, NoteUpdate, PieceJointeOut, TacheOut
from app.services import stockage
from app.services.domaines_utils import resoudre_domaines
from app.services.export_notes import GENERATEURS

router = APIRouter(prefix="/notes", tags=["notes"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_TAILLE_OCTETS = 10 * 1024 * 1024  # 10 Mo


def _nom_fichier_sur(nom: str) -> str:
    """Filtre un nom de fichier pour un usage sûr dans un en-tête Content-Disposition —
    un guillemet casse sinon la valeur de l'en-tête, un retour à la ligne fait lever une
    erreur serveur sur toute tentative de téléchargement de cette pièce jointe."""
    return re.sub(r'[\r\n"]+', "_", nom).strip() or "fichier"


@router.get("", response_model=list[NoteOut])
def lister_notes(
    contexte: Optional[Literal["pro", "perso"]] = None,
    domaine_id: Optional[int] = None,
    sans_tag: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    # domaines/pieces_jointes sont en lazy loading par défaut : sans eager loading, chaque
    # note de la liste déclenche ses propres requêtes séparées vers Supabase — sur une
    # liste de plusieurs dizaines de notes, la latence réseau cumulée peut se compter en
    # secondes (constaté : plusieurs secondes de lenteur sur l'écran Notes).
    query = db.query(Note).options(selectinload(Note.domaines), selectinload(Note.pieces_jointes))
    if contexte:
        # Une note sans domaine n'a pas de contexte déterminable — toujours visible,
        # plutôt que masquée arbitrairement d'un côté (voir spec, Onglet Notes).
        query = query.filter(
            or_(~Note.domaines.any(), Note.domaines.any(Domaine.contexte.in_([contexte, Contexte.les_deux])))
        )
    if sans_tag:
        query = query.filter(~Note.domaines.any())
    elif domaine_id:
        query = query.filter(Note.domaines.any(Domaine.id == domaine_id))
    return query.order_by(Note.cree_le.desc()).all()


def _hote_public(hostname: str) -> Optional[str]:
    """Refuse les hôtes qui résolvent vers une IP privée, loopback, lien-local ou réservée
    (ex. 169.254.169.254, métadonnées cloud), pour empêcher le serveur d'être utilisé comme
    proxy SSRF. Retourne l'IP publique validée (à épingler pour la connexion réelle, voir
    _ConnexionHTTPEpinglee/_ConnexionHTTPSEpinglee ci-dessous) plutôt qu'un simple booléen :
    sans épinglage, urllib refait sa propre résolution DNS au moment de la connexion, après
    cette vérification — un DNS malveillant pourrait répondre une IP publique ici puis une IP
    privée à la connexion réelle quelques centaines de ms plus tard (DNS rebinding)."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return None
    ip_validee = None
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            return None
        if ip_validee is None:
            ip_validee = info[4][0]
    return ip_validee


def _url_apercu_autorisee(url: str) -> Optional[tuple[str, str]]:
    """Retourne (hostname, ip_validee) si l'URL est autorisée, sinon None."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.hostname:
        return None
    ip = _hote_public(parsed.hostname)
    if ip is None:
        return None
    return parsed.hostname, ip


class _ConnexionHTTPEpinglee(http.client.HTTPConnection):
    """Connexion HTTP dont l'adresse de connexion réelle est fixée à l'IP déjà validée
    par _hote_public, indépendamment du Host utilisé pour la requête elle-même — voir
    _hote_public pour le TOCTOU que ça évite."""

    def __init__(self, *args, ip_epinglee: str, **kwargs):
        self._ip_epinglee = ip_epinglee
        super().__init__(*args, **kwargs)

    def connect(self):
        self.sock = socket.create_connection((self._ip_epinglee, self.port), self.timeout)


class _ConnexionHTTPSEpinglee(http.client.HTTPSConnection):
    """Idem en HTTPS : la connexion TCP va vers l'IP épinglée, mais le SNI et la
    validation du certificat restent sur le vrai nom d'hôte (server_hostname) — seule
    la résolution DNS est court-circuitée, pas la vérification TLS."""

    def __init__(self, *args, ip_epinglee: str, **kwargs):
        self._ip_epinglee = ip_epinglee
        super().__init__(*args, **kwargs)

    def connect(self):
        sock = socket.create_connection((self._ip_epinglee, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


class _GestionnaireEpingle(urllib.request.HTTPHandler, urllib.request.HTTPSHandler):
    """Force chaque connexion à utiliser l'IP déjà validée pour l'hôte demandé (partagée
    avec _RedirectionValidee via `ip_par_hote`, alimentée à chaque saut de redirection),
    plutôt que de laisser urllib refaire sa propre résolution DNS."""

    def __init__(self, ip_par_hote: dict[str, str]):
        super().__init__()
        self._ip_par_hote = ip_par_hote

    def _ip_pour(self, req) -> str:
        return self._ip_par_hote[urlparse(req.full_url).hostname]

    def http_open(self, req):
        return self.do_open(functools.partial(_ConnexionHTTPEpinglee, ip_epinglee=self._ip_pour(req)), req)

    def https_open(self, req):
        return self.do_open(
            functools.partial(_ConnexionHTTPSEpinglee, ip_epinglee=self._ip_pour(req)), req, context=self._context
        )


class _RedirectionValidee(urllib.request.HTTPRedirectHandler):
    """Suit les redirections HTTP, mais revalide la nouvelle adresse (schéma + hôte
    public) à chaque saut avant de la suivre — un hôte autorisé pourrait sinon
    rediriger vers une adresse interne pour contourner la vérification initiale
    (SSRF). Très courant en pratique (http -> https, sans-www -> www...)."""

    def __init__(self, ip_par_hote: dict[str, str]):
        self._ip_par_hote = ip_par_hote

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        autorise = _url_apercu_autorisee(newurl)
        if not autorise:
            return None
        hote, ip = autorise
        self._ip_par_hote[hote] = ip
        return super().redirect_request(req, fp, code, msg, headers, newurl)


@router.get("/apercu-lien")
def apercu_lien(url: str):
    """Récupère titre et description d'une page pour préremplir l'import manuel d'un lien."""
    autorise = _url_apercu_autorisee(url)
    if not autorise:
        return {"titre": "", "apercu": ""}
    hote, ip = autorise
    ip_par_hote = {hote: ip}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        opener = urllib.request.build_opener(_GestionnaireEpingle(ip_par_hote), _RedirectionValidee(ip_par_hote))
        with opener.open(req, timeout=5) as resp:
            page_html = resp.read(200_000).decode("utf-8", errors="ignore")
    except (URLError, ValueError, TimeoutError, OSError, KeyError):
        return {"titre": "", "apercu": ""}

    titre_match = re.search(r"<title[^>]*>(.*?)</title>", page_html, re.IGNORECASE | re.DOTALL)
    desc_match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', page_html, re.IGNORECASE
    )
    if not desc_match:
        # Repli Open Graph : beaucoup de sites n'ont que og:description, pas la balise classique.
        desc_match = re.search(
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']', page_html, re.IGNORECASE
        )

    def _nettoyer(texte: str) -> str:
        # Décode les entités HTML (&amp;, &#39;...) et réduit les espaces/retours à la
        # ligne issus de la mise en forme du HTML source, sinon "Nus &amp; culottés"
        # reste tel quel au lieu d'afficher "Nus & culottés".
        return " ".join(html.unescape(texte).split())

    return {
        "titre": _nettoyer(titre_match.group(1)) if titre_match else "",
        "apercu": _nettoyer(desc_match.group(1)) if desc_match else "",
    }


@router.post("", response_model=NoteOut, status_code=201)
def creer_note(note: NoteCreate, db: Session = Depends(get_db)):
    try:
        domaines = resoudre_domaines(db, note.domaine_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    obj = Note(**note.model_dump(exclude={"domaine_ids"}))
    obj.domaines = domaines
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{note_id}", response_model=NoteOut)
def modifier_note(note_id: int, note: NoteUpdate, db: Session = Depends(get_db)):
    obj = db.get(Note, note_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Note introuvable")
    donnees = note.model_dump(exclude_unset=True)
    if "domaine_ids" in donnees:
        try:
            obj.domaines = resoudre_domaines(db, donnees.pop("domaine_ids"))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    for champ, valeur in donnees.items():
        setattr(obj, champ, valeur)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{note_id}", status_code=204)
def supprimer_note(note_id: int, db: Session = Depends(get_db)):
    obj = db.get(Note, note_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Note introuvable")
    db.query(VeilleItem).filter(VeilleItem.note_generee_id == note_id).update({"note_generee_id": None})
    # Supprime la ligne DB avant les fichiers physiques : si le commit échoue, on garde
    # au pire des fichiers orphelins (invisibles, sans conséquence) plutôt qu'une note
    # dont les pièces jointes pointeraient vers des fichiers déjà effacés.
    noms_stockes = [piece.nom_stocke for piece in obj.pieces_jointes]
    db.delete(obj)
    db.commit()
    for nom_stocke in noms_stockes:
        stockage.supprimer(nom_stocke)


@router.post("/{note_id}/transformer-tache", response_model=TacheOut, status_code=201)
def transformer_en_tache(note_id: int, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    if not note.domaines:
        raise HTTPException(
            status_code=400, detail="La note doit avoir un tag de domaine pour être transformée en tâche"
        )
    tache = Tache(
        titre=note.titre,
        description=note.contenu or note.apercu,
        priorite=Priorite.un_jour,
        derniere_interaction=datetime.now(),
    )
    tache.domaines = list(note.domaines)
    db.add(tache)
    db.commit()
    db.refresh(tache)
    return tache


def _charger_notes_a_fusionner(db: Session, note_ids: list[int]) -> list[Note]:
    if len(note_ids) < 2:
        raise HTTPException(status_code=400, detail="Sélectionnez au moins deux notes à fusionner")
    notes = db.query(Note).filter(Note.id.in_(note_ids)).all()
    if len(notes) != len(set(note_ids)):
        raise HTTPException(status_code=404, detail="Une ou plusieurs notes sont introuvables")
    return notes


def _domaines_fusionnes(notes: list[Note]) -> list[Domaine]:
    vus = {}
    for note in notes:
        for domaine in note.domaines:
            vus[domaine.id] = domaine
    domaines = list(vus.values())
    contextes_stricts = {d.contexte for d in domaines if d.contexte != Contexte.les_deux}
    if len(contextes_stricts) > 1:
        raise HTTPException(
            status_code=400, detail="Les notes sélectionnées doivent être du même contexte Pro/Perso pour être fusionnées"
        )
    return domaines


def _titre_fusionne(notes: list[Note], titre: Optional[str]) -> str:
    if titre and titre.strip():
        return titre.strip()[:255]
    return " + ".join(n.titre for n in sorted(notes, key=lambda n: n.cree_le))[:255]


def _contenu_fusionne(notes: list[Note]) -> str:
    """Concatène le contenu de chaque note (ordre chronologique), en bloc distinct
    titré, pour ne rien perdre de l'information d'origine plutôt que de tenter une
    fusion "intelligente" du texte."""
    blocs = []
    for note in sorted(notes, key=lambda n: n.cree_le):
        lignes = [f"## {note.titre}"]
        if note.url:
            lignes.append(note.url)
        if note.apercu:
            lignes.append(note.apercu)
        if note.contenu:
            lignes.append(note.contenu)
        blocs.append("\n\n".join(lignes))
    return "\n\n---\n\n".join(blocs)


@router.post("/fusionner-en-note", response_model=NoteOut, status_code=201)
def fusionner_en_note(payload: FusionNotesPayload, db: Session = Depends(get_db)):
    """Consolide plusieurs notes en une seule (contenu concaténé, domaines fusionnés,
    pièces jointes réassignées) puis supprime les notes d'origine — une vraie fusion,
    pas une copie : décision produit explicite pour éviter le contenu dupliqué."""
    notes = _charger_notes_a_fusionner(db, payload.note_ids)
    domaines = _domaines_fusionnes(notes)

    nouvelle = Note(
        titre=_titre_fusionne(notes, payload.titre),
        contenu=_contenu_fusionne(notes),
        source=SourceNote.manuel,
    )
    nouvelle.domaines = domaines
    db.add(nouvelle)
    db.flush()

    for note in notes:
        for piece in list(note.pieces_jointes):
            note.pieces_jointes.remove(piece)
            nouvelle.pieces_jointes.append(piece)

    for note in notes:
        db.delete(note)

    db.commit()
    db.refresh(nouvelle)
    return nouvelle


@router.post("/fusionner-en-tache", response_model=TacheOut, status_code=201)
def fusionner_en_tache(payload: FusionNotesPayload, db: Session = Depends(get_db)):
    """Crée une tâche à partir de plusieurs notes fusionnées, sans toucher aux notes
    d'origine — cohérent avec le comportement non destructif de /transformer-tache
    sur une note unique."""
    notes = _charger_notes_a_fusionner(db, payload.note_ids)
    domaines = _domaines_fusionnes(notes)
    if not domaines:
        raise HTTPException(
            status_code=400, detail="Les notes sélectionnées doivent avoir au moins un domaine pour être fusionnées en tâche"
        )

    tache = Tache(
        titre=_titre_fusionne(notes, payload.titre),
        description=_contenu_fusionne(notes),
        priorite=Priorite.un_jour,
        derniere_interaction=datetime.now(),
    )
    tache.domaines = domaines
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

    morceaux: list[bytes] = []
    taille = 0
    while True:
        morceau = await fichier.read(1024 * 1024)
        if not morceau:
            break
        taille += len(morceau)
        if taille > MAX_TAILLE_OCTETS:
            raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
        morceaux.append(morceau)
    contenu = b"".join(morceaux)

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
        headers={"Content-Disposition": f'attachment; filename="{_nom_fichier_sur(piece.nom_original)}"'},
    )


@router.delete("/pieces-jointes/{piece_id}", status_code=204)
def supprimer_piece_jointe(piece_id: int, db: Session = Depends(get_db)):
    piece = db.get(PieceJointe, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce jointe introuvable")
    nom_stocke = piece.nom_stocke
    db.delete(piece)
    db.commit()
    stockage.supprimer(nom_stocke)
