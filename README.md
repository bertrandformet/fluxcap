# FluxCap

*"Marty, voici le Flux Capacitor des idées et des actions."*

## L'origine du projet

Chaque jour, un même constat face au Flux : cette marée faite d'articles de veille à lire, d'idées de projets spontanées, de notes volantes et de tâches urgentes. Ce flux est un carburant, mais sans structure, il finit par submerger.

FluxCap est né d'un besoin simple : ne pas bloquer ce Flux, mais lui imposer un Cap.

### La mécanique : trois flux, une mire

À l'image du célèbre convecteur temporel de Retour vers le futur, l'application fonctionne comme un point de convergence de trois faisceaux distincts pour n'en former qu'un seul, orienté vers l'avenir :

1. **Le flux des connaissances** (la veille) : capturer l'information pertinente sans la laisser se perdre.
2. **Le flux de la pensée** (les notes) : poser les idées à chaud, dans un espace épuré, pour libérer la charge mentale.
3. **La ligne de mire** (les tâches) : le cap, le point de convergence où les tâches en cours, la veille et les notes peuvent se transformer en actions concrètes et planifiées.


### La philosophie

FluxCap écarte les usines à gaz et les processus rigides pour se concentrer sur la maîtrise de l'attention. En reliant directement ce qui est appris à ce qui doit être fait, l'application élimine la friction. Libéré des onglets accumulés et des listes de tâches déconnectées de la réalité, chacun peut tracer sa propre trajectoire. Organiser le présent permet de propulser, sereinement, son "moi du futur".

## En pratique

Application personnelle de gestion des tâches et de la veille — deux contextes séparés (Pro / Perso), sélection quotidienne limitée à 3-4 tâches, clôture avec décision obligatoire, veille par domaine, notes filtrables par tag.

Voir [spec-fluxcap.md](./spec-fluxcap.md) pour la spécification complète.

## Captures

Onglet "Aujourd'hui"
<img width="905" height="844" alt="Capture d’écran 2026-07-17 à 14 51 12" src="https://github.com/user-attachments/assets/8fcd2646-7edb-4ac7-b0d6-819ae3caadc4" />

Onglet "Clôture"
<img width="900" height="748" alt="Capture d’écran 2026-07-17 à 14 51 19" src="https://github.com/user-attachments/assets/b331ead8-f3e5-46b0-a376-6b54f55a3535" />

Onglet "Notes"
<img width="889" height="746" alt="Capture d’écran 2026-07-17 à 14 51 31" src="https://github.com/user-attachments/assets/dd721c23-696f-4d5e-9227-ec578f4d84a9" />

Onglet "Veille"
<img width="897" height="946" alt="Capture d’écran 2026-07-17 à 14 51 42" src="https://github.com/user-attachments/assets/bfdafc35-f727-4f00-9e3c-d6d7f66487e6" />

Onglet "Domaines"
<img width="903" height="785" alt="Capture d’écran 2026-07-17 à 14 51 49" src="https://github.com/user-attachments/assets/b24ce825-1b35-4139-a285-2865a7567a09" />

Onglet "Tableau de bord"
<img width="902" height="664" alt="Capture d’écran 2026-07-17 à 14 51 55" src="https://github.com/user-attachments/assets/e0e36dc1-8f06-4c15-aa4d-b5039965c80c" />

Mode "Congés"
<img width="908" height="842" alt="Capture d’écran 2026-07-17 à 14 52 07" src="https://github.com/user-attachments/assets/beaee11d-c6ea-4188-812f-0a7cb1e0806e" />

Ajout d'une tâche
<img width="892" height="424" alt="Capture d’écran 2026-07-17 à 14 52 17" src="https://github.com/user-attachments/assets/53c22b2e-ed33-4dc6-a5cf-7a09744de9fc" />

Ajout d'une note
<img width="888" height="732" alt="Capture d’écran 2026-07-17 à 14 52 28" src="https://github.com/user-attachments/assets/49407ba6-fb0d-4c37-b3c0-6f49d0e5767f" />

Ajout d'une source de veille
<img width="405" height="569" alt="Capture d’écran 2026-07-17 à 14 52 36" src="https://github.com/user-attachments/assets/abc72995-9822-4264-8e53-2792f69f1314" />


## État actuel

POC fonctionnel (logique + écrans), déployé, protégé par authentification (mot de passe + WebAuthn/Face ID/Touch ID). Veille alimentée automatiquement (flux RSS/Atom) et notifications email d'ouverture/clôture, déclenchées par un workflow GitHub Actions planifié. Données factices uniquement en développement local — la base de production est vide par défaut.

## Structure

- `backend/` — API FastAPI, SQLite en local / Postgres en production
- `frontend/` — PWA React (Vite)

## Déploiement

- **Frontend** : [Vercel](https://vercel.com), racine du projet `frontend/`, build Vite standard.
- **Backend** : [Render](https://render.com), plan gratuit, déployé via le Blueprint [`render.yaml`](./render.yaml) à la racine du repo.
- **Base de données** : Postgres géré par [Supabase](https://supabase.com) (le plan gratuit de Render n'a pas de disque persistant).
- **Pièces jointes** : bucket [Supabase Storage](https://supabase.com) (même raison — voir `backend/app/services/stockage.py`, qui retombe sur le disque local si aucune variable Supabase n'est renseignée).

Toutes les variables d'environnement nécessaires (connexion Postgres, clés Supabase, origine CORS, clé de signature des sessions, config WebAuthn) sont listées dans [`.env.example`](./.env.example) et dans `render.yaml`. Aucune valeur réelle n'est commitée ; elles sont saisies directement dans les tableaux de bord Render/Vercel.

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

## Licence

© Bertrand Formet, codéveloppé avec Claude Code. Ce projet est distribué sous licence [Creative Commons BY 4.0](./LICENSE).
