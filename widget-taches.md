# Widget tâches en cours — iPhone et Mac

Affiche les tâches Pro/Perso en attente sans ouvrir FluxCap : un widget iPhone (écran d'accueil, via Scriptable) et un menu Mac (barre de menu, via xbar). Les deux lisent l'API existante (`GET /jour/{contexte}`), authentifiée par la même clé API longue durée que le raccourci de capture (voir [raccourci-partage.md](./raccourci-partage.md) pour la générer).

Piste initialement envisagée et abandonnée : faire apparaître le widget iPhone directement dans le centre de notifications du Mac via Continuité (widgets iPhone sur Mac, macOS Sonoma+/Tahoe). **Bloqué par une restriction régionale UE**, y compris depuis le flux normal de la galerie de widgets (pas seulement l'app séparée "Recopie d'iPhone") — message d'erreur observé : *"Connexion à l'iPhone impossible / La recopie de l'iPhone n'est pas disponible dans votre pays ou région."* D'où le choix d'un widget Mac natif séparé (xbar) plutôt qu'un partage du widget iPhone.

## iPhone : Scriptable

[Scriptable](https://apps.apple.com/app/scriptable/id1405459188) (app iOS/iPadOS gratuite, App Store — pas de version Mac, l'app est spécifiquement iPhone/iPad) exécute un script JavaScript et peut l'afficher comme widget d'écran d'accueil.

Principe du script :
1. Appelle `GET /jour/pro` et `GET /jour/perso` (en-tête `Authorization: Bearer <clé API>`).
2. Filtre les tâches dont `statut_jour == "en_attente"`.
3. Construit un `ListWidget` (titre + liste des tâches, un widget séparé par contexte plutôt qu'un seul widget mixte Pro/Perso).
4. `Script.setWidget(...)` puis `Script.complete()`.

Installation : créer le script dans l'app Scriptable, puis depuis l'écran d'accueil iPhone → "+" → chercher "Scriptable" → choisir la taille → configurer le widget pour pointer vers ce script précis (paramètre du widget = nom du script si plusieurs scripts).

## Mac : xbar

Pas d'équivalent direct de Scriptable sur Mac ; [xbar](https://xbarapp.com/) (gratuit, open source, anciennement BitBar) exécute un script en boucle et affiche son résultat dans la barre de menu.

### Installation

1. Télécharger depuis xbarapp.com (pas sur l'App Store), ouvrir l'app.
2. Si rien ne s'affiche après ouverture : le plus souvent l'icône est déjà là mais masquée par trop d'icônes dans la barre de menu (raccourcir/réorganiser la barre de menu pour la retrouver) — plus rarement Gatekeeper bloque un exécutable téléchargé hors App Store (Réglages Système → Confidentialité et sécurité → "Ouvrir quand même").
3. xbar surveille `~/Library/Application Support/xbar/plugins/`.

### Script

Le nom de fichier encode l'intervalle de rafraîchissement (`fluxcap.5m.py` = toutes les 5 min). Doit être exécutable (`chmod +x`).

```python
#!/usr/bin/env python3
# <xbar.title>FluxCap</xbar.title>
# <xbar.version>1.0</xbar.version>
# <xbar.desc>Tâches du jour FluxCap (Pro/Perso) dans la barre de menu</xbar.desc>

import json
import urllib.request
import urllib.error

CLE_API = "COLLER_LA_CLE_API_ICI"
BASE_URL = "https://taches-notes-veille-api.onrender.com"

def charger_jour(contexte):
    req = urllib.request.Request(
        f"{BASE_URL}/jour/{contexte}",
        headers={"Authorization": f"Bearer {CLE_API}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.load(resp)
    except (urllib.error.URLError, TimeoutError, OSError):
        return None

def taches_en_attente(jour):
    if not jour:
        return []
    return [s["tache"]["titre"] for s in jour["selection"] if s["statut_jour"] == "en_attente"]

pro = charger_jour("pro")
perso = charger_jour("perso")
taches_pro = taches_en_attente(pro)
taches_perso = taches_en_attente(perso)

if pro is None and perso is None:
    print("🧭 ?")
else:
    print(f"🧭 {len(taches_pro)}/{len(taches_perso)}")

print("---")
print(f"Pro — {len(taches_pro)} tâche(s)")
if not taches_pro:
    print("--Rien à traiter | color=gray")
for titre in taches_pro:
    print(f"--{titre} | href=https://fluxcap.vercel.app")

print("---")
print(f"Perso — {len(taches_perso)} tâche(s)")
if not taches_perso:
    print("--Rien à traiter | color=gray")
for titre in taches_perso:
    print(f"--{titre} | href=https://fluxcap.vercel.app")

print("---")
print("Rafraîchir | refresh=true")
print("Ouvrir FluxCap | href=https://fluxcap.vercel.app")
```

Remplacer `COLLER_LA_CLE_API_ICI` par la clé API générée dans FluxCap (panneau Sécurité). Cliquer sur un titre de tâche ouvre FluxCap dans le navigateur par défaut (`href=`) ; sans ce paramètre, une ligne `--` reste du texte informatif non cliquable (comportement par défaut d'xbar).

Après toute modification du script : sauvegarder, puis dans le menu xbar → **Refresh all** (sinon attendre le prochain cycle de 5 min).

## Limites connues

- Le compte à rebours affiché dans le titre de la barre de menu (`🧭 pro/perso`) ne compte que les tâches `en_attente` — les tâches réalisées dans la journée n'apparaissent pas, cohérent avec le reste de FluxCap.
- Comme pour le raccourci de capture, la clé API est en clair dans le script — acceptable ici car le fichier reste local sur la machine de l'utilisateur, jamais commité dans ce repo.
