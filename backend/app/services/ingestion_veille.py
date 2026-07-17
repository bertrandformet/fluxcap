"""Collecte de veille : flux RSS/Atom uniquement (via feedparser), déclenchée par un
appel planifié externe (voir app/routers/veille.py + le workflow GitHub Actions)."""

import html
import re
import socket

import feedparser
from sqlalchemy.orm import Session

from app.models import Contexte, SourceVeille, StatutVeille, VeilleItem

BALISE_HTML = re.compile(r"<[^>]+>")
LONGUEUR_MAX_APERCU = 300
DELAI_MAX_SECONDES = 15


def _texte_brut(html_brut: str) -> str:
    sans_balises = BALISE_HTML.sub(" ", html_brut or "")
    texte = html.unescape(sans_balises)
    texte = " ".join(texte.split())
    return texte[:LONGUEUR_MAX_APERCU]


def ingerer_source(db: Session, source: SourceVeille) -> int:
    """Parse le flux d'une source et crée les VeilleItem manquants (dédupliqués par
    URL). Une source sans domaine assigné est ignorée. Retourne le nombre d'items créés."""
    if not source.domaine_id:
        return 0

    ancien_delai = socket.getdefaulttimeout()
    socket.setdefaulttimeout(DELAI_MAX_SECONDES)
    try:
        flux = feedparser.parse(source.url)
    finally:
        socket.setdefaulttimeout(ancien_delai)

    nouveaux = 0
    for entree in flux.entries:
        lien = entree.get("link")
        titre = entree.get("title")
        if not lien or not titre:
            continue
        if db.query(VeilleItem).filter(VeilleItem.url == lien).first():
            continue
        db.add(
            VeilleItem(
                titre=titre.strip(),
                url=lien,
                apercu=_texte_brut(entree.get("summary", "")),
                domaine_id=source.domaine_id,
                source=source.nom,
                statut=StatutVeille.nouveau,
            )
        )
        nouveaux += 1
    if nouveaux:
        db.commit()
    return nouveaux


def ingerer_contexte(db: Session, contexte: Contexte) -> int:
    sources = (
        db.query(SourceVeille)
        .filter(SourceVeille.contexte == contexte, SourceVeille.actif.is_(True), SourceVeille.domaine_id.isnot(None))
        .all()
    )
    total = 0
    for source in sources:
        try:
            total += ingerer_source(db, source)
        except Exception:
            continue  # une source en erreur ne doit pas bloquer les autres
    return total
