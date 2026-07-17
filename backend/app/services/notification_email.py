"""Notifications par email (API Resend, appel HTTP direct via urllib — pas de SDK
supplémentaire) à l'ouverture/clôture Pro/Perso. Déclenchées par un appel planifié
externe, voir app/routers/planification.py et le workflow GitHub Actions."""

import json
import urllib.request
from datetime import date
from urllib.error import URLError

from sqlalchemy.orm import Session

from app.config import NOTIFICATION_EMAIL, RESEND_API_KEY, RESEND_FROM
from app.models import Contexte, Parametres, RaisonSelection, SelectionJour, StatutJour
from app.services.selection_jour import obtenir_ou_construire_selection

LABELS_CONTEXTE = {Contexte.pro: "Pro", Contexte.perso: "Perso"}


def _envoyer(sujet: str, corps: str) -> bool:
    if not RESEND_API_KEY or not NOTIFICATION_EMAIL:
        print(f"[notification_email] variables manquantes : cle={bool(RESEND_API_KEY)} email={bool(NOTIFICATION_EMAIL)}")
        return False
    charge = json.dumps({"from": RESEND_FROM, "to": [NOTIFICATION_EMAIL], "subject": sujet, "text": corps}).encode(
        "utf-8"
    )
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=charge,
        method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            # Sans User-Agent explicite, Python envoie "Python-urllib/x.y", une
            # signature bloquée par la protection Cloudflare devant l'API Resend.
            "User-Agent": "FluxCap/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except URLError as e:
        detail = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else str(e)
        print(f"[notification_email] echec envoi Resend : {detail}")
        return False


def _conges_actif(db: Session) -> bool:
    parametres = db.get(Parametres, 1)
    return bool(parametres and parametres.conges_actif)


def notifier_ouverture(db: Session, contexte: Contexte) -> bool:
    """Pas de notification Pro en mode congés — voir spec, planning des notifications."""
    if contexte == Contexte.pro and _conges_actif(db):
        return False

    label = LABELS_CONTEXTE[contexte]
    selection = obtenir_ou_construire_selection(db, contexte, date.today())
    principales = [
        s for s in selection if s.raison_selection != RaisonSelection.recurrente and s.statut_jour == StatutJour.en_attente
    ]
    if not principales:
        corps = f"Rien de particulier à traiter aujourd'hui côté {label}."
    else:
        lignes = "\n".join(f"- {s.tache.titre}" for s in principales)
        corps = f"{len(principales)} tâche(s) t'attendent aujourd'hui ({label}) :\n\n{lignes}"
    return _envoyer(f"{label} — Aujourd'hui", corps)


def notifier_cloture(db: Session, contexte: Contexte) -> bool:
    if contexte == Contexte.pro and _conges_actif(db):
        return False

    label = LABELS_CONTEXTE[contexte]
    en_attente = (
        db.query(SelectionJour)
        .filter(
            SelectionJour.date == date.today(),
            SelectionJour.contexte == contexte,
            SelectionJour.statut_jour == StatutJour.en_attente,
            SelectionJour.raison_selection != RaisonSelection.recurrente,
        )
        .count()
    )
    if en_attente == 0:
        corps = f"Journée {label} déjà clôturée, rien en attente."
    else:
        corps = f"{en_attente} tâche(s) {label} encore en attente — pense à clôturer ta journée."
    return _envoyer(f"{label} — Clôture", corps)
