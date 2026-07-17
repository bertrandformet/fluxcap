import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'taches_veille.db'}")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Pièces jointes : disque local par défaut (dev). En prod (Render, disque éphémère),
# renseigner SUPABASE_URL/SUPABASE_SERVICE_KEY/SUPABASE_BUCKET pour basculer sur un
# bucket Supabase Storage à la place — voir app/services/stockage.py.
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "app" / "uploads"))
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "pieces-jointes")

# Signature des sessions JWT. En prod, DOIT être renseignée via l'env (secret long et
# aléatoire) — le défaut ci-dessous n'est là que pour que le dev local fonctionne sans
# rien configurer.
SECRET_KEY = os.getenv("SECRET_KEY", "cle-de-developpement-locale-a-ne-jamais-utiliser-en-prod")

# WebAuthn (Face ID / Touch ID) : RP_ID doit être le domaine exact du frontend (sans
# schéma ni port), ORIGIN l'origine complète. "localhost" fonctionne en dev même en
# http ; en prod, ex. RP_ID=taches-notes-veille.vercel.app.
WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "FluxCap")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:5173")

# Authentifie les appels planifiés (GitHub Actions) vers /veille/ingestion et
# /notifications/declencher — un secret partagé statique, pas une session utilisateur,
# puisque ces endpoints sont appelés sans utilisateur connecté.
SCHEDULER_SECRET = os.getenv("SCHEDULER_SECRET", "")

# Envoi d'email (Resend) pour les notifications d'ouverture/clôture.
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")
NOTIFICATION_EMAIL = os.getenv("NOTIFICATION_EMAIL", "")
