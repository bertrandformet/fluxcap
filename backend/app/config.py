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
