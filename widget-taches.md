# Widget tâches en cours — iPhone et Mac

Affiche les tâches Pro/Perso en attente sans ouvrir FluxCap : un widget iPhone (écran d'accueil, via Scriptable) et un menu Mac (barre de menu, via xbar). Les deux lisent l'API existante (`GET /jour/{contexte}`), authentifiée par la même clé API longue durée que le raccourci de capture (voir [raccourci-partage.md](./raccourci-partage.md) pour la générer).

Piste initialement envisagée et abandonnée : faire apparaître le widget iPhone directement dans le centre de notifications du Mac via Continuité (widgets iPhone sur Mac, macOS Sonoma+/Tahoe). **Bloqué par une restriction régionale UE**, y compris depuis le flux normal de la galerie de widgets (pas seulement l'app séparée "Recopie d'iPhone") — message d'erreur observé : *"Connexion à l'iPhone impossible / La recopie de l'iPhone n'est pas disponible dans votre pays ou région."* D'où le choix d'un widget Mac natif séparé (xbar) plutôt qu'un partage du widget iPhone.

## iPhone : Scriptable

[Scriptable](https://apps.apple.com/app/scriptable/id1405459188) (app iOS/iPadOS gratuite, App Store — pas de version Mac, l'app est spécifiquement iPhone/iPad) exécute un script JavaScript et peut l'afficher comme widget d'écran d'accueil.

Un widget séparé par contexte plutôt qu'un seul widget mixte Pro/Perso : deux instances du même script, différenciées par le paramètre du widget (`pro`/`perso`).

### Script

```js
// FluxCap – widget des tâches du jour (Scriptable)
const CLE_API = "COLLER_LA_CLE_API_ICI";
const BASE_URL = "https://taches-notes-veille-api.onrender.com";
const CONTEXTE = (args.widgetParameter || "pro").trim().toLowerCase();

const COULEUR_FOND = new Color("#16211D");
const COULEUR_TEXTE = new Color("#F2F7F4");
const COULEUR_MUTED = new Color("#8FA39A");
const COULEUR_ACCENT = new Color("#0A84FF");

async function chargerJour() {
  const req = new Request(`${BASE_URL}/jour/${CONTEXTE}`);
  req.headers = { Authorization: `Bearer ${CLE_API}` };
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

function creerWidgetErreur(message) {
  const w = new ListWidget();
  w.backgroundColor = COULEUR_FOND;
  w.setPadding(14, 14, 14, 14);
  const t = w.addText("FluxCap");
  t.font = Font.boldSystemFont(14);
  t.textColor = COULEUR_TEXTE;
  w.addSpacer(6);
  const e = w.addText(message);
  e.font = Font.systemFont(12);
  e.textColor = COULEUR_MUTED;
  return w;
}

function creerWidget(jour) {
  const w = new ListWidget();
  w.backgroundColor = COULEUR_FOND;
  w.setPadding(14, 14, 14, 14);

  const titre = w.addText(CONTEXTE === "pro" ? "FluxCap · Pro" : "FluxCap · Perso");
  titre.font = Font.boldSystemFont(14);
  titre.textColor = COULEUR_TEXTE;
  w.addSpacer(8);

  const enAttente = (jour.selection || []).filter((s) => s.statut_jour === "en_attente");

  const famille = config.widgetFamily || "medium";
  const maxAffiches = famille === "small" ? 3 : famille === "large" ? 8 : 5;

  if (enAttente.length === 0) {
    const vide = w.addText("Rien à traiter aujourd'hui 🎉");
    vide.font = Font.systemFont(12);
    vide.textColor = COULEUR_MUTED;
  } else {
    enAttente.slice(0, maxAffiches).forEach((s) => {
      const ligne = w.addText(`•  ${s.tache.titre}`);
      ligne.font = Font.systemFont(12);
      ligne.textColor = COULEUR_TEXTE;
      ligne.lineLimit = 1;
      w.addSpacer(4);
    });
    if (enAttente.length > maxAffiches) {
      const reste = w.addText(`+ ${enAttente.length - maxAffiches} autre(s)`);
      reste.font = Font.systemFont(11);
      reste.textColor = COULEUR_MUTED;
      w.addSpacer(4);
    }
  }

  const veille = (jour.veille_a_traiter || []).length;
  if (veille > 0) {
    w.addSpacer(6);
    const v = w.addText(`${veille} nouveau(x) en veille`);
    v.font = Font.systemFont(10);
    v.textColor = COULEUR_ACCENT;
  }

  return w;
}

let widget;
try {
  const jour = await chargerJour();
  widget = creerWidget(jour);
} catch (e) {
  widget = creerWidgetErreur("Erreur de connexion");
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
```

Remplacer `COLLER_LA_CLE_API_ICI` par la clé API générée dans FluxCap (panneau Sécurité) — **piège rencontré** : tant que ce placeholder n'est pas remplacé, le widget affiche silencieusement "Rien à traiter aujourd'hui 🎉" au lieu d'une erreur visible. Cause : `Request.loadJSON()` dans Scriptable ne lève pas d'exception sur une réponse HTTP non-2xx (401 non authentifié inclus), donc le `catch` du script n'est jamais déclenché ; le corps JSON de l'erreur n'a pas de champ `selection`, `(jour.selection || [])` retombe sur un tableau vide, et l'écran "vide" s'affiche comme si tout était traité — un faux négatif qui ressemble à un succès. Toujours vérifier la clé en premier si le widget affiche "Rien à traiter" alors que des tâches sont attendues (comparer avec l'écran Aujourd'hui de l'app ou le widget Mac xbar).

Installation : créer le script dans l'app Scriptable, puis depuis l'écran d'accueil iPhone → "+" → chercher "Scriptable" → choisir la taille → configurer le widget pour pointer vers ce script précis, avec `pro` ou `perso` dans le champ Paramètre (un widget par contexte).

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
    # xbar découpe une ligne sur le premier "|" pour séparer texte et paramètres (ex.
    # href=...) : un titre contenant lui-même un "|" casse ce format. On le remplace par
    # un caractère visuellement proche plutôt que de le retirer.
    return [
        s["tache"]["titre"].replace("|", "❘")
        for s in jour["selection"]
        if s["statut_jour"] == "en_attente"
    ]

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
