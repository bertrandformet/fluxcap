# Raccourci Apple Shortcuts — Ajouter à FluxCap

Raccourci qui apparaît dans le menu Partager natif (iPhone/Mac, synchronisé via iCloud) et capture un lien ou un texte partagé directement en note dans FluxCap, sans ouvrir l'app.

Remplace l'usage manuel de l'API Web Share du navigateur pour ce cas d'usage précis : capturer un article/lien pendant sa lecture ailleurs (Safari, Mail, une autre app), sans interrompre le flux pour ouvrir FluxCap et coller l'URL à la main.

## Résultat

- Partage un lien depuis Safari → une note apparaît dans FluxCap, sans domaine assigné (à trier ensuite dans l'écran Notes), avec :
  - **titre** : le vrai titre de la page si trouvable, sinon l'URL elle-même
  - **url** : le lien
  - **apercu** : la meta-description de la page (classique ou Open Graph), si disponible
- Partage un texte simple (pas de lien) → une note avec ce texte comme titre, sans URL ni aperçu.

## Prérequis : clé API

Le raccourci s'authentifie auprès du backend avec une clé API dédiée — indépendante des sessions de connexion classiques (mot de passe/Face ID), elle n'expire jamais et se révoque à tout moment.

Dans FluxCap → icône clé (**Sécurité**) → section **"Clé API (raccourcis externes)"** → "Générer une clé API" → copier la clé affichée (elle ne sera plus jamais visible en clair, il faut la regénérer si perdue).

## Construction du raccourci

Dans l'app **Raccourcis** (macOS ou iOS — se synchronise automatiquement entre les deux via iCloud) :

1. Créer un nouveau raccourci, nommé par exemple "Ajouter à FluxCap".
2. Dans les Détails du raccourci (icône ⓘ) : cocher **"Dans la feuille de partage"**.

### Actions, dans l'ordre

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

### Sur Mac

Si le raccourci n'apparaît pas directement dans le menu Partager : Réglages Système → Extensions → Menu Partager → cocher le raccourci.

## Limites connues

- **Sites protégés par un bouclier anti-bot** (Cloudflare "Client Challenge" et équivalents, fréquent sur les grands sites de presse) : la récupération du titre/résumé échoue silencieusement, seule l'URL est capturée comme titre. Pas de correctif possible sans navigateur headless complet — hors de portée pour ce petit récupérateur de métadonnées.
- **Sites à redirection non-HTTP** (ex. redirection par frame HTML plutôt que par en-tête HTTP) : même limitation, le récupérateur ne peut suivre que les redirections HTTP standards (301/302), pas le rendu côté client.
- Dans les deux cas, le lien est quand même capturé normalement dans Notes — seul le titre/résumé automatique manque, à compléter à la main si besoin.
