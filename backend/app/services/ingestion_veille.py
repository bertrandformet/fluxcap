"""Collecte de veille : flux RSS/Atom uniquement (via feedparser), déclenchée par un
appel planifié externe (voir app/routers/veille.py + le workflow GitHub Actions)."""

import html
import re
import socket
from datetime import datetime
from typing import Optional

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


def _date_publication(entree) -> Optional[datetime]:
    """feedparser normalise la date de publication (RSS `pubDate`, Atom `published`...)
    en `published_parsed`, avec `updated_parsed` en repli si seule une date de mise à jour
    est fournie. Certains flux n'exposent ni l'un ni l'autre — repli None dans ce cas
    (l'UI retombe alors sur la date de collecte)."""
    struct = entree.get("published_parsed") or entree.get("updated_parsed")
    if not struct:
        return None
    return datetime(*struct[:6])


def ingerer_source(db: Session, source: SourceVeille) -> int:
    """Parse le flux d'une source et crée les VeilleItem manquants (dédupliqués par
    URL). Une source sans domaine assigné est ignorée. Retourne le nombre d'items créés."""
    if not source.domaine_id:
        return 0
    domaine = source.domaine

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
        nouvel_item = VeilleItem(
            titre=titre.strip(),
            url=lien,
            apercu=_texte_brut(entree.get("summary", "")),
            source=source.nom,
            statut=StatutVeille.nouveau,
            date_publication=_date_publication(entree),
        )
        nouvel_item.domaines = [domaine]
        db.add(nouvel_item)
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
