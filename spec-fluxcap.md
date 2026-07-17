# Spécification — FluxCap (gestion des tâches et de la veille)

## Contexte
Application personnelle et privée destinée à remplacer les outils précédents (Notion, Todoist...) qui n'ont pas tenu dans la durée, faute de rituel quotidien stable et à cause de la friction d'usage. Le design s'appuie sur des résultats de recherche en psychologie cognitive et en neurosciences (intentions d'implémentation, effet Zeigarnik, limite de la mémoire de travail à ~4 éléments, formation des habitudes via les ganglions de la base).

## État d'implémentation (POC)

Légende : ✅ fait · ⚠️ fait différemment de la spec initiale · ⏳ pas encore fait (hors périmètre POC, assumé) · ❌ oublié (à faire)

| Élément de la spec initiale | État |
|---|---|
| PWA React + FastAPI, logique et écrans locaux | ✅ |
| Authentification (mot de passe / WebAuthn) | ⚠️ mot de passe fait (session JWT, toutes les routes protégées) ; WebAuthn/passkey pas encore fait |
| Déploiement Vercel/Render | 🚧 configuration prête (render.yaml, variables d'env), déploiement effectif à faire côté comptes Render/Vercel |
| Planning des notifications (horaires Pro/Perso) | ⚠️ fait par email (Resend) plutôt que push navigateur — déclenché par un workflow GitHub Actions planifié, respecte le mode congés pour Pro |
| Mode congés | ✅ bascule visuelle + Pro grisé/dépriorisé + notifications Pro coupées (mail) + Perso bascule sur le rythme week-end (9h/21h) tous les jours pendant les congés |
| Écran Aujourd'hui (3-4 tâches, score, épinglage, report remonté) | ✅ |
| Anti-oubli | ⚠️ seuil passé de 14 à 7 jours (changement demandé en cours de POC) |
| Écran de clôture (décision obligatoire, compteur sans streak) | ✅ |
| Modèle de tâche : titre, domaine, type, priorité, date de fin, date événement + délai | ✅ |
| Sous-tâches (avec suggestion automatique) | ❌ **oublié** — modèle et API existent (`sous_taches`), aucune interface pour les créer/afficher, suggestion automatique jamais codée |
| Jalons intermédiaires | ❌ **oublié** — modèle et API existent (`jalons`), aucune interface |
| Historique de report | ✅ stocké et utilisé pour la remontée automatique, mais pas affiché comme historique consultable |
| Onglet Veille (groupé par domaine, 3 actions) | ✅ |
| Ingestion automatisée (`fetch_tools.py` en job planifié) | ⚠️ fait, mais limité aux flux RSS/Atom (feedparser) — pas de scraping générique ni d'API tierces. Déclenché par GitHub Actions, pas un vrai cron serveur |
| Onglet Notes (unique, filtrable par tag, import lien) | ✅ |
| Partage externe (sortant) | ⚠️ Web Share API native (macOS/iOS) au lieu d'un raccourci Apple Shortcuts dédié — même résultat pratique (menu de partage natif), mécanisme différent |
| Capture externe (entrant) | ✅ raccourci Apple Shortcuts dédié (voir [raccourci-partage.md](./raccourci-partage.md)), apparaît dans le menu Partager de n'importe quelle app (Safari...), crée une note dans FluxCap sans ouvrir l'app |
| Pomodoro (bouton sur tâches administratives, durée réglable) | ✅ |

Les domaines/sources ne sont plus des listes figées (DGESCO, DNE, DINUM...) : ils sont entièrement libres et gérables depuis l'application (voir "Onglet Domaines").

## Architecture générale
- **PWA multiplateforme** (web, mobile iOS/Android, desktop) — un seul code, navigation responsive (barre d'onglets flottante en bas d'écran sur mobile, nav classique en haut sur desktop)
- **Stack** : React + Vite (frontend) + FastAPI + SQLite (backend)
- **Hébergement** (cible finale, config prête, déploiement à faire) : Vercel (frontend, gratuit) + Render (backend, plan payant Starter ~7$/mois requis pour le disque persistant SQLite/pièces jointes). Repli possible : serveur OVH personnel existant (utilisé pour uneIAparjour.fr)
- **Repo public** avec données factices/exemples ; vraies données et configuration dans `.env` ignoré par git, jamais commité
- **Authentification** : mot de passe classique fait (premier réglage au premier lancement, session JWT côté client, toutes les routes API protégées sauf /auth et /health). Face ID/Touch ID (WebAuthn/passkey) prévu en méthode alternative, pas encore fait.
- **Approche de développement** : POC fonctionnel d'abord dans Claude Code (logique et données), habillage visuel ensuite via Claude Design une fois le code existant, avec handoff retour vers Claude Code

## Deux onglets séparés : Pro / Perso
Pas un simple filtre — deux contextes distincts, chacun avec son propre rituel matin/soir.

### Planning des notifications (pas encore implémenté)
| Jour | Pro | Perso |
|---|---|---|
| Lun–Ven | 7h30 (ouverture) + 17h30 (clôture) | 21h (ouverture) + 7h (clôture, juste avant Pro) |
| Sam–Dim | — | 9h (ouverture) + 21h (clôture) |

### Mode congés
Statut activable/désactivable ("🏖️ Congés" dans l'en-tête, à côté du sélecteur Pro/Perso). Tant qu'actif :
- le contexte Pro reste accessible (pas bloqué) mais ses tâches sont grisées, et les tâches épinglées perdent leur priorité de tête de liste (elles redescendent, triées normalement) — rien n'est modifié en base, tout redevient normal à la désactivation
- bascule sur le rythme week-end (9h/21h Perso) tous les jours, aucune notification Pro

Pas de date de fin à saisir — se désactive manuellement.

## Écran "Aujourd'hui" (ouverture)
- **3-4 tâches maximum affichées** (limite de la mémoire de travail, Cowan ~4 chunks) dans la liste principale
- Sélection par score = priorité × urgence (jours avant échéance)
- Les tâches reportées la veille remontent automatiquement en premier
- Épinglage manuel possible pour forcer une tâche dans le quota du jour
- Bouton "Réalisé" directement sur chaque carte (pas seulement à la clôture) : dès qu'une tâche est marquée faite, la suivante par score remonte automatiquement pour garder le quota rempli
- Formulaire "+ Tâche" pour créer une tâche manuellement (titre, domaine, priorité, échéance, administrative, récurrente, épinglée) — n'existait pas dans la spec initiale, qui décrivait le modèle sans écran de création
- **Tâches récurrentes** (nouveau) : une tâche peut être marquée récurrente ; une fois réalisée elle se régénère automatiquement pour le lendemain au lieu de rester clôturée. Les tâches récurrentes ne concurrencent jamais le quota des 3-4 : elles ont leur propre bloc dédié
- **Veille toujours visible séparément**, jamais en concurrence avec les 3-4 tâches — regroupée avec le bloc des tâches récurrentes (même traitement visuel : hors quota, toujours accessible)
- **Mécanisme anti-oubli** : une tâche jamais touchée depuis **7 jours** (14 initialement, réduit en cours de POC) est forcée une fois dans les 3-4, avec décision obligatoire (garder / reprioriser / abandonner), pas de report possible sur ce cas

## Écran de clôture (soir)
- Liste des tâches du jour avec statut fait/pas fait
- Pour chaque tâche non faite : décision explicite obligatoire (reporter à demain / reporter à une date / abandonner) — jamais de report silencieux par défaut
- Compteur simple fait/reporté, **sans notion de streak ni de dette**
- Formulation toujours positive ("À réaliser" plutôt que "Non faite"), jamais culpabilisante

## Modèle de tâche
| Champ | Détail |
|---|---|
| Titre | texte libre |
| Domaine/source | libre, géré depuis l'onglet Domaines, tagué Pro ou Perso |
| Type | manuel — valeur "administrative" active le bouton Pomodoro |
| Priorité | 3 niveaux (un jour / cette semaine / aujourd'hui) |
| Épinglée | booléen, force l'inclusion dans le quota du jour |
| Récurrente | booléen (nouveau) — la tâche se régénère chaque jour après réalisation au lieu de rester clôturée |
| Date de fin | avec jalons intermédiaires optionnels si tâche longue — **jalons non exposés dans l'UI (voir État d'implémentation)** |
| Date d'événement + délai de préparation | pour tâches liées à un événement fixe (ex. "préparer formation X") — distinct de la date de fin, surface automatiquement selon le délai configuré |
| Sous-tâches | optionnelles, suggérées automatiquement si échéance > 5-7 jours ou texte de description long — jamais systématique — **non exposées dans l'UI, suggestion automatique non codée (voir État d'implémentation)** |
| Historique de report | dates de report successives, utile pour repérer les tâches qui traînent |

## Onglet Domaines (nouveau)
Écran de gestion des domaines/tags, nécessaire car les domaines sont entièrement libres (plus de liste figée type DGESCO/DNE/DINUM) :
- Ajout, renommage, changement de contexte (Pro/Perso), suppression
- Suppression bloquée si le domaine est encore utilisé par une tâche, un item de veille ou une note
- Ces mêmes domaines servent de tags pour filtrer les notes

## Onglet Veille (séparé, par domaine)
- Items groupés par domaine, affichés en cartes (même style visuel que les tâches d'Aujourd'hui), avec un résumé du lien (nouveau champ `apercu`)
- 3 actions rapides par item : ignorer / garder pour lecture (→ envoyé automatiquement vers l'onglet Notes) / transformer en tâche
- **Filtre par domaine** (nouveau), sélection unique ou multiple
- **Actualisation automatique** de la liste à 7h et 20h (nouveau), tant que l'écran reste ouvert dans le navigateur — ne déclenche pas de vraie collecte, relit simplement les données actuelles
- **Sources de veille** (nouveau) : panneau "⚙️ Sources" pour ajouter/désactiver/supprimer les sources à interroger, taguées Pro ou Perso. Gère uniquement la configuration — inspiré de `uneIAparjour/veille-agregateurs`, mais la collecte réelle (RSS/API/scraping vers des sites tiers) n'est pas implémentée
- **Ingestion automatisée** (pas encore fait) : migration de `fetch_tools.py` en job planifié
  - Veille Pro : tous les matins avant 7h30
  - Veille Perso (uneIAparjour) : tous les soirs à 20h

## Onglet Notes
- **Unique et filtrable par tag** (pas séparé Pro/Perso — les tags de domaine suffisent à s'y retrouver), avec un filtre supplémentaire "Sans tag" (nouveau)
- **Badge d'alerte visuel** ("⚠ Sans tag", nouveau) sur toute note sans domaine, pour éviter qu'elle passe inaperçue
- Import manuel : champ "coller un lien" avec récupération auto du titre/aperçu
- **Éditeur de texte markdown** (nouveau) avec barre d'outils (titres, gras, italique, barré, code, listes, case à cocher, citation, lien, ligne horizontale) et bascule aperçu/édition, pour rédiger des notes de texte libres et pas seulement importer des liens
- **Pièces jointes** (nouveau) : upload de fichier ou image par note (10 Mo max), miniature pour les images, téléchargement, suppression
- **Export** (nouveau) de chaque note en `.txt`, `.md` ou `.docx`
- **Sélection multiple** (nouveau) : suppression en masse, ajout de tag en masse, partage groupé
- Alimentation automatique par l'action "garder pour lecture" de l'onglet Veille (tag de domaine hérité automatiquement)
- **Partage externe sortant** : ⚠️ implémenté via l'API Web Share native du navigateur (`navigator.share`), qui ouvre le menu de partage natif macOS/iOS — au lieu du raccourci Apple Shortcuts unique synchronisé via iCloud initialement prévu. Repli automatique sur copie presse-papiers si l'API n'est pas disponible
- **Capture externe entrante** : ✅ raccourci Apple Shortcuts (voir [raccourci-partage.md](./raccourci-partage.md)) qui crée une note dans FluxCap depuis le menu Partager de n'importe quelle app, authentifié via une clé API dédiée générée dans le panneau Sécurité

## Tableau de bord (nouveau)
Vue factuelle ajoutée en cours de POC, volontairement **sans historique ni tendance** pour rester cohérente avec le refus de toute notion de streak/dette :
- Répartition des tâches actives par domaine
- Répartition des tâches actives par priorité
- Barres proportionnelles au total du groupe (et non au maximum local), avec le compte affiché ("3 / 8")

## Pomodoro (optionnel)
- Bouton "🍅 Focus" visible uniquement sur les tâches de type "administrative"
- Durée réglable (pas figée à 25/5), focus et pause configurables séparément
- Pas de gamification ni de compteur de sessions accumulées
- **Sons distincts par événement** (nouveau, inspirés de l'UX macOS/iOS) : lancement d'une phase, mise en pause, fin de cycle complet, plus une alerte discrète avant la fin (2 min avant si la phase dépasse 10 min, 1 min avant sinon)
- **Notifications navigateur** (nouveau) à chaque transition de phase

## Notes de recherche ayant guidé les choix de design
- **Intentions d'implémentation** ("si X, alors Y") : un seul déclencheur stable par comportement, pas plusieurs concurrents
- **Cadrage positif > évitement** : formuler les rappels en action, jamais en dette ; rater un jour n'a pas d'impact mesurable sur la trajectoire globale
- **Effet Zeigarnik** : un plan explicite de report referme la tension cognitive presque aussi bien que la tâche terminée — d'où la décision obligatoire au moment de la clôture
- **Mémoire de travail (Cowan)** : capacité réelle ~4 éléments, d'où la limite stricte de l'écran "Aujourd'hui"
- **Ganglions de la base / habitudes** : le transfert vers l'automatique dépend de la répétition du même déclencheur dans un contexte stable
- **Goal-setting theory (Locke & Latham)** : le découpage en sous-tâches proximales n'aide que si chaque sous-tâche est elle-même spécifique — d'où le découpage conditionnel, pas systématique
- **Pomodoro** : les pauses systématiques améliorent la concentration mais augmentent la fatigue plus vite et peuvent casser le flow sur du travail complexe — d'où sa restriction aux seules tâches administratives
