# Capture rapide de notes — partage externe

Deux façons de capturer un lien (ou un texte) directement en note dans FluxCap, sans ouvrir l'app à la main : un raccourci Apple Shortcuts (iPhone/Mac, menu Partager natif) et un favori Chrome (bookmarklet, multiplateforme).

Remplace l'usage manuel de l'API Web Share du navigateur pour ce cas d'usage précis : capturer un article/lien pendant sa lecture ailleurs, sans interrompre le flux pour ouvrir FluxCap et coller l'URL à la main.

## Apple Shortcuts (iPhone/Mac)

Raccourci qui apparaît dans le menu Partager natif (synchronisé entre iPhone et Mac via iCloud).

### Résultat

- Partage un lien depuis Safari → une note apparaît dans FluxCap, sans domaine assigné (à trier ensuite dans l'écran Notes), avec :
  - **titre** : le vrai titre de la page si trouvable, sinon l'URL elle-même
  - **url** : le lien
  - **apercu** : la meta-description de la page (classique ou Open Graph), si disponible
- Partage un texte simple (pas de lien) → une note avec ce texte comme titre, sans URL ni aperçu.

### Prérequis : clé API

Le raccourci s'authentifie auprès du backend avec une clé API dédiée — indépendante des sessions de connexion classiques (mot de passe/Face ID), elle n'expire jamais et se révoque à tout moment.

Dans FluxCap → icône clé (**Sécurité**) → section **"Clé API (raccourcis externes)"** → "Générer une clé API" → copier la clé affichée (elle ne sera plus jamais visible en clair, il faut la regénérer si perdue).

### Construction du raccourci

Dans l'app **Raccourcis** (macOS ou iOS — se synchronise automatiquement entre les deux via iCloud) :

1. Créer un nouveau raccourci, nommé par exemple "Ajouter à FluxCap".
2. Dans les Détails du raccourci (icône ⓘ) : cocher **"Dans la feuille de partage"**.

#### Actions, dans l'ordre

1. **Obtenir URL de la page** depuis `Entrée de raccourci` → variable `Lien`
   *(utiliser précisément "Obtenir URL de la page", pas "Obtenir les URL de..." — cette dernière scanne le contenu de la page et remonte tous les liens qu'elle contient, pas seulement son URL propre.)*
2. **Définir la variable** `Titre` sur `Entrée de raccourci` *(valeur par défaut, pour le cas d'un partage de texte simple sans lien)*
3. **Si** `Lien` possède n'importe quelle valeur :
   1. **Définir la variable** `Titre` sur `Lien` *(fallback : le titre sera au moins l'URL si la suite échoue)*
   2. **Texte** : `https://taches-notes-veille-api.onrender.com/notes/apercu-lien?url=` suivi de la variable `Lien` insérée à la fin, dans le même champ → renommer le résultat `UrlApercu`
   3. **Obtenir le contenu de** `UrlApercu` — Méthode `GET`, en-tête `Authorization: Bearer <clé API>` → **Définir la variable** `ApercuLien` sur ce résultat
   4. **Obtenir la valeur du dictionnaire** — Dictionnaire = `ApercuLien`, Clé = texte `titre` → **Définir la variable** `TitreServeur` sur ce résultat
   5. **Obtenir la valeur du dictionnaire** — Dictionnaire = `ApercuLien`, Clé = texte `apercu` → **Définir la variable** `Apercu` sur ce résultat
   6. **Si** `TitreServeur` possède n'importe quelle valeur → **Définir la variable** `Titre` sur `TitreServeur` (remplace le fallback URL par le vrai titre) → Terminer si
   - Terminer si
4. **Obtenir le contenu de** `https://taches-notes-veille-api.onrender.com/notes` :
   - Méthode : `POST`
   - En-têtes : `Authorization: Bearer <clé API>`, `Content-Type: application/json`
   - Corps (type **JSON**, pas Texte — évite les problèmes d'échappement) : `titre` = `Titre`, `url` = `Lien`, `apercu` = `Apercu`
5. **Afficher une notification** (optionnel) : confirmation visuelle après capture.

#### Sur Mac

Si le raccourci n'apparaît pas directement dans le menu Partager : Réglages Système → Extensions → Menu Partager → cocher le raccourci.

## Favori Chrome (bookmarklet)

Chrome ne supporte pas nativement les raccourcis Apple Shortcuts. Un bookmarklet (favori dont l'URL est du JavaScript) fait le même travail, avec deux différences pratiques :

- Marche sur Chrome/Chromium partout (Mac, Windows, Linux, Android) — pas seulement l'écosystème Apple.
- Pas de clé API à copier nulle part : le bookmarklet ouvre FluxCap dans un petit onglet, qui crée la note via **ta session déjà connectée** dans le navigateur (même origine, pas de souci CORS ni de secret exposé dans le favori).

### Résultat

Ouvre une petite fenêtre FluxCap qui capture automatiquement le titre et l'URL de la page courante en note (sans domaine assigné), affiche une confirmation, puis se referme toute seule après ~1 seconde. Ne récupère pas de résumé (`apercu`) — contrairement au raccourci Shortcuts, qui appelle `apercu-lien` explicitement.

### Installation (Chrome)

1. Faire un clic droit sur la barre de favoris → "Ajouter une page" (ou glisser n'importe quel favori existant puis modifier son URL).
2. Nom : `Ajouter à FluxCap`.
3. URL/Adresse : coller tel quel (une seule ligne) :

```
javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title);window.open('https://fluxcap.vercel.app/?capture_url='+u+'&capture_titre='+t,'fluxcap_capture','width=420,height=320');})();
```

4. Enregistrer. Sur n'importe quelle page, cliquer sur ce favori dans la barre pour capturer la page courante.

Si Chrome refuse de sauvegarder une URL commençant par `javascript:` (rare, dépend des versions) : créer d'abord le favori avec une URL classique, puis le modifier ensuite (clic droit → Modifier) pour coller le code JavaScript.

## Limites connues (les deux mécanismes)

Le résumé automatique (`apercu`, uniquement pour le raccourci Shortcuts) dépend de `GET /notes/apercu-lien` côté backend, qui a deux limites :

- **Sites protégés par un bouclier anti-bot** (Cloudflare "Client Challenge" et équivalents, fréquent sur les grands sites de presse) : la récupération du titre/résumé échoue silencieusement, seule l'URL est capturée comme titre. Pas de correctif possible sans navigateur headless complet — hors de portée pour ce petit récupérateur de métadonnées.
- **Sites à redirection non-HTTP** (ex. redirection par frame HTML plutôt que par en-tête HTTP) : même limitation, le récupérateur ne peut suivre que les redirections HTTP standards (301/302), pas le rendu côté client.

Dans les deux cas, le lien est quand même capturé normalement dans Notes — seul le titre/résumé automatique manque, à compléter à la main si besoin.
