# Tâches, Notes & Veille

Application personnelle de gestion des tâches et de la veille — deux contextes séparés (Pro / Perso), sélection quotidienne limitée à 3-4 tâches, clôture avec décision obligatoire, veille par domaine, notes filtrables par tag.

Voir [spec-taches-notes-veille.md](./spec-taches-notes-veille.md) pour la spécification complète.

## État actuel

POC fonctionnel (logique + écrans), sans authentification, sans notifications, sans déploiement. Données factices pour le développement.

## Structure

- `backend/` — API FastAPI + SQLite
- `frontend/` — PWA React (Vite)

## Démarrage local

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed   # peuple la base avec des données factices
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration

Copier `.env.example` vers `.env` et adapter les valeurs. Le fichier `.env` n'est jamais commité.
