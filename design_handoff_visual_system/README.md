# Handoff : habillage visuel — Tâches, Notes & Veille

## Contexte
POC fonctionnel terminé (React + Vite, FastAPI + SQLite, CSS système par défaut). Ce lot livre uniquement l'**habillage visuel** : un fichier `styles.css` (tokens + classes de composants) à réintégrer dans le frontend existant. **Aucune refonte de structure HTML/JSX n'est demandée ni proposée ici** — la structure des 6 écrans reste celle du POC.

## À propos des fichiers de ce dossier
- `styles.css` — **le livrable** : variables CSS (couleurs, typo, espacement, formes) + classes de composants (`.tnv-*`), prêtes à coller/adapter dans le CSS du repo.
- `reference-prototype.dc.html` — **référence visuelle uniquement** (prototype HTML/React interactif utilisé pour concevoir le style, exploré via 3 pistes + une variante retenue). Ce n'est pas du code à copier tel quel : il sert à voir le style en contexte (6 écrans, clair/sombre, mobile/desktop) et à vérifier que `styles.css` correspond bien à l'intention. La tâche pour Claude Code est d'appliquer les classes de `styles.css` aux composants React réels du repo `taches-notes-veille`, pas de recréer ce fichier.
- `reference-mock-data.js` — les données factices utilisées dans le prototype (pour comprendre la forme des cartes/listes affichées).

## Fidélité
**Hifi.** Couleurs, typographie, espacement et rayons ci-dessous sont définitifs (issus de la piste retenue). À appliquer tel quel, pas de réinterprétation nécessaire.

## Direction retenue
Piste "Repère" (cartes aérées, rayons généreux 22px, priorité au calme visuel) avec l'accent bleu système de la piste "Clarté" (`#0A84FF`) plutôt que le teal initial — décision explicite de l'utilisateur après avoir comparé 3 pistes. Police : Inter (webfont neutre, cohérente iOS/Android/desktop — voir Google Fonts `Inter:wght@400;500;600;700;800`).

## Contraintes UX à préserver dans l'intégration (ne pas régresser)
- **Écran Aujourd'hui : 3-4 tâches maximum** dans la liste principale — ne jamais afficher les tâches récurrentes/veille dans la même liste ni au même style visuel ; elles vivent dans un bloc à part (`.tnv-card--dashed`, bordure pointillée, fond `--tnv-card-2`) pour ne jamais concurrencer visuellement le quota du jour.
- **Aucune formulation culpabilisante** : "À réaliser" jamais "Non faite" ; pas de mot "dette" ou "retard" à l'écran.
- **Pas de gamification** : le tableau de bord n'a ni streak, ni compteur de séries, ni courbe — seulement des barres proportionnelles factuelles (`.tnv-bar-track` / `.tnv-bar-fill`) avec le compte affiché ("3 / 8").
- **Décision de clôture** = geste simple : les 3 options (`.tnv-decision-option--primary/secondary/tertiary`) sont des boutons pleine largeur au même niveau visuel, jamais un dialogue de confirmation anxiogène.
- Cibles tactiles ≥ 44px partout (`.tnv-btn`, `.tnv-icon-btn`, `.tnv-tabbar__item` sont déjà calés dessus).

## Écrans couverts
Aujourd'hui, Clôture, Notes (éditeur markdown + pièces jointes + sélection multiple), Veille (cartes + panneau Sources), Domaines, Tableau de bord. Voir `reference-prototype.dc.html` pour chacun en contexte.

## Composants clés (classes dans `styles.css`)
| Composant | Classes |
|---|---|
| Carte de tâche | `.tnv-card.tnv-task-card` + `.tnv-task-card__body/__title/__meta/__actions` |
| Badge de statut / domaine | `.tnv-badge`, `.tnv-badge--accent`, `.tnv-badge--warning`, `.tnv-badge--domain` (+ `--domain-hue` inline), `.tnv-dot` |
| Boutons icône (Réalisé/Épingler/Récurrente/Pomodoro) | `.tnv-icon-btn`, `.tnv-icon-btn--active` — icônes en SVG trait fin, pas d'icon font |
| Sélecteur Pro/Perso | `.tnv-segmented` + `.tnv-segmented__option(--active)` |
| Barre d'onglets (mobile) | `.tnv-tabbar` (flottante, position fixed bottom) + `.tnv-tabbar__item(--active)` |
| Navigation (desktop) | `.tnv-nav` + `.tnv-nav__item(--active)` |
| Modale de décision (clôture) | `.tnv-overlay.tnv-sheet` > `.tnv-sheet__panel` > `.tnv-decision-option--*` |
| Minuteur Pomodoro | `.tnv-overlay.tnv-modal-center` > `.tnv-pomodoro` (`__task`, `__phase(--pause)`, `__time`) |
| Barre d'outils markdown | `.tnv-md-toolbar` + `.tnv-md-toolbar__btn`, éditeur : `.tnv-md-editor` |
| Sélection multiple (Notes) | `.tnv-select-dot(--checked)` + `.tnv-bulk-bar` |
| Barres du tableau de bord | `.tnv-bar-row` > `__labels` + `.tnv-bar-track` > `.tnv-bar-fill` (width en style inline) |
| Switch (sources, congés) | `.tnv-switch(--on)` > `.tnv-switch__knob` |

## Domaines (tags libres, couleur par teinte)
Les domaines sont créés librement par l'utilisateur (pas de liste figée) : leur couleur d'identification vient d'une **teinte** posée en inline (`style="--domain-hue: 250"`), calculée par exemple par un hash du nom ou de l'id du domaine. Luminosité/chroma restent fixes (`--tnv-domain-l/--tnv-domain-c` dans `styles.css`) pour que toutes les couleurs de domaine restent cohérentes entre elles.

## Mode sombre
Piloté par l'attribut `data-theme="dark"` sur un ancêtre (ex. `<html>`), avec repli automatique sur `prefers-color-scheme` si l'app ne force pas de préférence. Aucune classe supplémentaire à ajouter par composant — tout est piloté par les variables de `:root` / `[data-theme="dark"]`.

## Captures d'écran
Voir `screenshots/` (les 6 écrans, mobile, thème clair, contexte Pro).

## Assets
Aucun logo/icône fournis par le repo. Les icônes du prototype sont de simples SVG trait (cercle de coche, épingle, boucle "récurrent", tomate Pomodoro) — à recréer avec la librairie d'icônes déjà utilisée dans le repo si elle existe, sinon garder ce style trait fin minimal.

## Fichiers du repo à modifier (côté Claude Code)
Le CSS actuel du frontend (`frontend/`) est "minimal sans habillage" d'après la description du projet — probablement un seul fichier global (`index.css` ou équivalent) importé une fois. Étapes suggérées :
1. Coller le contenu de `styles.css` (ou l'importer tel quel) dans le CSS global du frontend.
2. Ajouter `data-theme` (ou un toggle stocké en préférence utilisateur) sur l'élément racine.
3. Appliquer les classes `.tnv-*` aux composants JSX existants (carte de tâche, barre d'onglets, modales, etc.) sans changer leur structure/logique.
4. Poser `--domain-hue` inline partout où un domaine est affiché.
