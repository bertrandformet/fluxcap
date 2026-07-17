# FluxCap

*Le convecteur temporel des idées et des actions.*

## L'origine du projet

Chaque jour, un même constat s'impose face au Flux : cette marée numérique ininterrompue faite d'articles de veille à lire, d'idées de projets spontanées, de notes volantes et de tâches urgentes. Ce flux est le carburant de la créativité, mais sans structure, il finit par submerger la concentration.

FluxCap est né d'un besoin simple : ne pas bloquer ce courant, mais lui imposer un Cap.

### La mécanique : trois flux, une mire

À l'image du célèbre convecteur temporel, l'application fonctionne comme un point de collision où convergent trois faisceaux distincts pour n'en former qu'un seul, orienté vers l'avenir :

1. **Le flux des connaissances** (la Veille) : capturer l'information pertinente sans la laisser se perdre dans les limbes du navigateur.
2. **Le flux de la pensée** (les Notes) : poser les idées à chaud, dans un espace épuré, pour libérer la charge mentale.
3. **La ligne de mire** (les Tâches) : le cap, le point de convergence où la veille et les notes se transforment en actions concrètes et planifiées.

Lorsque ces trois éléments s'alignent, la sensation de courir après le temps disparaît.

### La philosophie

FluxCap écarte les usines à gaz et les processus rigides pour se concentrer sur la maîtrise de l'attention. En reliant directement ce qui est appris à ce qui doit être fait, l'application élimine la friction. Libéré des onglets accumulés et des listes de tâches déconnectées de la réalité, chacun peut tracer sa propre trajectoire. Organiser le présent permet de propulser, sereinement, son "moi du futur".

## En pratique

Application personnelle de gestion des tâches et de la veille — deux contextes séparés (Pro / Perso), sélection quotidienne limitée à 3-4 tâches, clôture avec décision obligatoire, veille par domaine, notes filtrables par tag.

Voir [spec-fluxcap.md](./spec-fluxcap.md) pour la spécification complète.

## Captures

<img width="712" height="610" alt="Capture d’écran 2026-07-16 à 21 38 13" src="https://github.com/user-attachments/assets/247b172f-619c-4461-a5ef-5afdad90075b" />
<img width="707" height="558" alt="Capture d’écran 2026-07-16 à 21 38 20" src="https://github.com/user-attachments/assets/42308ae8-8f3e-4525-9e3a-5d2f998786e5" />
<img width="709" height="538" alt="Capture d’écran 2026-07-16 à 21 38 27" src="https://github.com/user-attachments/assets/5e68c407-42a1-4221-82c0-7cccdbc4057f" />
<img width="707" height="551" alt="Capture d’écran 2026-07-16 à 21 38 33" src="https://github.com/user-attachments/assets/13f1fa05-7bb2-4456-9806-d77dca4885d2" />
<img width="714" height="593" alt="Capture d’écran 2026-07-16 à 21 38 39" src="https://github.com/user-attachments/assets/32ea0e84-4e15-4f18-bdcc-2fb538a575a1" />
<img width="700" height="501" alt="Capture d’écran 2026-07-16 à 21 38 46" src="https://github.com/user-attachments/assets/6ee8ba8d-762b-4692-8520-63d58cf1aa40" />

<img width="710" height="326" alt="Capture d’écran 2026-07-16 à 21 39 05" src="https://github.com/user-attachments/assets/56fa12e2-3c03-4934-a0ce-b8c90c4d904d" />
<img width="709" height="562" alt="Capture d’écran 2026-07-16 à 21 38 57" src="https://github.com/user-attachments/assets/5a973566-5bbe-4118-ab2e-ec4b594a8df5" />
<img width="672" height="499" alt="Capture d’écran 2026-07-16 à 21 39 15" src="https://github.com/user-attachments/assets/91cee900-887d-4509-85d7-c30229a42297" />




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
