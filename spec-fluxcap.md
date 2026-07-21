# Spécification — FluxCap (gestion des tâches, des notes et de la veille)

## Contexte
Application personnelle et privée destinée à remplacer les outils précédents (Notion, Todoist...) qui n'ont pas tenu dans la durée, faute de rituel quotidien stable et à cause de la friction d'usage. Le design s'appuie sur des articles de recherche en psychologie cognitive et en neurosciences (intentions d'implémentation, effet Zeigarnik, limite de la mémoire de travail à ~4 éléments, mise en place des habitudes).

## État d'implémentation (POC)

Légende : ✅ fait · ⚠️ fait différemment de la spec initiale · ⏳ pas encore fait (hors périmètre POC, assumé) · ❌ oublié (à faire)

| Élément de la spec initiale | État |
|---|---|
| PWA React + FastAPI, logique et écrans locaux | ✅ |
| Authentification (mot de passe / WebAuthn) | ✅ mot de passe + WebAuthn/Face ID/Touch ID, session JWT, toutes les routes protégées. Panneau Sécurité (nouveau) : changer son mot de passe en étant connecté, régénérer le code de récupération à la demande, révoquer toutes les sessions ouvertes, clé API longue durée pour intégrations externes |
| Déploiement Vercel/Render | ✅ en production (Vercel + Render + Supabase) |
| Planning des notifications (horaires Pro/Perso) | ⚠️ fait par email (Resend) plutôt que push navigateur — déclenché par un workflow GitHub Actions planifié, respecte le mode congés pour Pro |
| Mode congés | ✅ bascule visuelle + Pro grisé/dépriorisé + notifications Pro coupées (mail) + Perso bascule sur le rythme week-end (9h/21h) tous les jours pendant les congés |
| Écran Aujourd'hui (3-4 tâches, score, épinglage, report remonté) | ✅ |
| Anti-oubli | ⚠️ seuil passé de 14 à 7 jours (changement demandé en cours de POC) |
| Écran de clôture (décision obligatoire, compteur sans streak) | ✅ |
| Modèle de tâche : titre, domaine(s), type, priorité, date de fin, date événement + délai | ✅ multi-domaines (une tâche/note/item de veille peut porter plusieurs domaines, tous du même contexte, sauf domaine "les_deux" — voir Domaines) |
| Modification d'une tâche déjà créée | ✅ titre, description, priorité, échéance, type (administrative) éditables en place via l'icône crayon sur la carte |
| Sous-tâches (avec suggestion automatique) | ✅ interface faite (disclosure "Détails" sur chaque tâche : cocher/ajouter/supprimer) + suggestion proactive (badge "💡 Échéance lointaine / Description détaillée — découper en sous-tâches ?") si échéance >7 jours ou description >150 caractères et aucune sous-tâche encore créée |
| Jalons intermédiaires | ✅ interface faite (même disclosure "Détails" : titre, date, cocher/ajouter/supprimer) |
| Historique de report | ✅ stocké, utilisé pour la remontée automatique, et affiché comme historique consultable dans le disclosure "Détails" de chaque tâche |
| Onglet Veille (groupé par domaine, 3 actions) | ✅ |
| Ingestion automatisée (`fetch_tools.py` en job planifié) | ⚠️ fait, mais limité aux flux RSS/Atom (feedparser) — pas de scraping générique ni d'API tierces. Déclenché par GitHub Actions, pas un vrai cron serveur |
| Onglet Notes (unique, filtrable par tag, import lien) | ✅ vue à deux volets façon Notes d'Apple (liste de titres + détail) |
| Partage externe (sortant) | ⚠️ Web Share API native (macOS/iOS) au lieu d'un raccourci Apple Shortcuts dédié — même résultat pratique (menu de partage natif), mécanisme différent |
| Capture externe (entrant) | ✅ raccourci Apple Shortcuts (menu Partager) + favori Chrome/bookmarklet (voir [raccourci-partage.md](./raccourci-partage.md)), crée une note dans FluxCap sans ouvrir l'app |
| Pomodoro (bouton sur tâches administratives, durée réglable) | ✅ |
| Widget tâches en cours (iPhone/Mac) | ✅ widget iPhone (Scriptable) + menu barre de menu Mac (xbar), tous deux via `GET /jour/{contexte}` — voir [widget-taches.md](./widget-taches.md) |

Les domaines/sources ne sont plus des listes figées : ils sont entièrement libres et gérables depuis l'application (voir "Onglet Domaines").

## Architecture générale
- **PWA multiplateforme** (web, mobile iOS/Android, desktop) — un seul code, navigation responsive (barre d'onglets flottante en bas d'écran sur mobile, nav classique en haut sur desktop)
- **Stack** : React + Vite (frontend) + FastAPI + SQLite (backend)
- **Hébergement** : Vercel (frontend, gratuit) + Render (backend, plan gratuit — pas de disque persistant, pièces jointes et base de données déportées vers Supabase). En production.
- **Repo public** avec données factices/exemples ; vraies données et configuration dans `.env` ignoré par git, jamais commité
- **Authentification** : mot de passe (premier réglage au premier lancement, session JWT côté client, toutes les routes API protégées sauf /auth et /health) et WebAuthn/Face ID/Touch ID, les deux fonctionnels. Panneau Sécurité : changement de mot de passe en session, régénération du code de récupération, révocation de toutes les sessions ouvertes, clé API longue durée pour intégrations externes (raccourcis, scripts).
- **Approche de développement** : POC fonctionnel d'abord dans Claude Code (logique et données), habillage visuel ensuite via Claude Design une fois le code existant, avec handoff retour vers Claude Code

## Deux onglets séparés : Pro / Perso
Pas un simple filtre — deux contextes distincts, chacun avec son propre rituel matin/soir.

### Planning des notifications
| Jour | Pro | Perso |
|---|---|---|
| Lun–Jeu | 7h30 (ouverture) + 17h30 (clôture) | 21h (ouverture) + 7h (clôture, juste avant Pro) |
| Vendredi | 7h30 (ouverture) + 13h (clôture) | 21h (ouverture) + 7h (clôture, juste avant Pro) |
| Sam–Dim | — | 9h (ouverture) + 21h (clôture) |

Ces horaires sont modifiables sans toucher au code backend (voir README, section "Horaires de notification") — ils sont définis par des expressions cron dans `.github/workflows/planification.yml`, y compris pour donner un horaire différent à un jour précis plutôt qu'à toute la semaine, comme pour la clôture Pro du vendredi ci-dessus.

### Mode congés
Statut activable/désactivable ("Congés" dans l'en-tête, à côté du sélecteur Pro/Perso). Tant qu'actif :
- le contexte Pro reste accessible (pas bloqué) mais ses tâches sont grisées, et les tâches épinglées perdent leur priorité de tête de liste (elles redescendent, triées normalement) — rien n'est modifié en base, tout redevient normal à la désactivation
- bascule sur le rythme week-end (notification 9h/21h Perso) tous les jours, aucune notification Pro

Pas de date de fin à saisir — se désactive manuellement.

## Écran "Aujourd'hui" (ouverture)
- **3-4 tâches maximum affichées** (limite de la mémoire de travail, Cowan ~4 chunks) dans la liste principale
- Sélection par score = priorité × urgence (jours avant échéance)
- Les tâches reportées la veille remontent automatiquement en premier
- Épinglage manuel possible pour forcer une tâche dans le quota du jour
- Bouton "Réalisé" directement sur chaque carte (pas seulement à la clôture) : dès qu'une tâche est marquée faite, la suivante par score remonte automatiquement pour garder le quota rempli
- **Annuler une réalisation par erreur** (nouveau) : bouton "Annuler" sur chaque ligne du bloc "Réalisées aujourd'hui", remet la tâche dans le quota du jour. Le quota peut transitoirement dépasser 3-4 tâches si une remontée automatique a déjà eu lieu entre-temps (pas de logique d'éviction, cas rare accepté).
- Formulaire "+ Tâche" pour créer une tâche manuellement (titre, domaine, priorité, échéance, administrative, récurrente, épinglée) — n'existait pas dans la spec initiale, qui décrivait le modèle sans écran de création
- **Tâches récurrentes** (nouveau) : une tâche peut être marquée récurrente ; une fois réalisée elle se régénère automatiquement pour le lendemain au lieu de rester clôturée. Les tâches récurrentes ne concurrencent jamais le quota des 3-4 : elles ont leur propre bloc dédié
- **Veille toujours visible séparément**, jamais en concurrence avec les 3-4 tâches — regroupée avec le bloc des tâches récurrentes (même traitement visuel : hors quota, toujours accessible)
- **Mécanisme anti-oubli** : une tâche jamais touchée depuis **7 jours** (14 initialement, réduit en cours de POC) est forcée une fois dans les 3-4, avec décision obligatoire (garder / reprioriser / abandonner), pas de report possible sur ce cas
- **Suppression directe** (nouveau) : bouton "Supprimer" (icône corbeille, avec confirmation) sur chaque carte de tâche, en plus des décisions de clôture (reporter/abandonner) — utile pour retirer une tâche créée par erreur sans attendre le soir

## Écran de clôture (soir)
- Liste des tâches du jour avec statut fait/pas fait
- Pour chaque tâche non faite : décision explicite obligatoire (reporter à demain / reporter à une date / abandonner) — jamais de report silencieux par défaut
- Compteur simple fait/reporté, **sans notion de streak ni de dette**
- Formulation toujours positive ("À réaliser" plutôt que "Non faite"), jamais culpabilisante

## Modèle de tâche
| Champ | Détail |
|---|---|
| Titre | texte libre |
| Domaines | **multi-domaines** (nouveau) : une tâche peut porter plusieurs domaines à la fois, tous obligatoirement du même contexte (Pro, Perso, ou "les deux") — géré depuis l'onglet Domaines, ou en ajout/retrait rapide directement depuis la carte (bouton "+ tag") |
| Type | manuel — valeur "administrative" active le bouton Pomodoro |
| Priorité | 3 niveaux (un jour / cette semaine / aujourd'hui) |
| Épinglée | booléen, force l'inclusion dans le quota du jour |
| Récurrente | booléen (nouveau) — la tâche se régénère chaque jour après réalisation au lieu de rester clôturée |
| Date de fin | avec jalons intermédiaires optionnels si tâche longue |
| Date d'événement + délai de préparation | pour tâches liées à un événement fixe (ex. "préparer formation X") — distinct de la date de fin, surface automatiquement selon le délai configuré |
| Sous-tâches | optionnelles, suggérées via un badge si échéance > 7 jours ou description > 150 caractères (et aucune sous-tâche déjà créée) |
| Historique de report | dates de report successives, utile pour repérer les tâches qui traînent |

## Onglet Domaines (nouveau)
Écran de gestion des domaines/tags, nécessaire car les domaines sont entièrement libres (plus de liste figée) :
- Ajout, renommage, changement de contexte (Pro/Perso/Les deux), suppression
- Suppression bloquée si le domaine est encore utilisé par une tâche, un item de veille ou une note
- Ces mêmes domaines servent de tags pour filtrer les notes
- **Usage par domaine** (nouveau) : chaque domaine peut être retiré du sélecteur de tâches et/ou du sélecteur de veille indépendamment (badges "Tâches"/"Veille" cliquables), pour les domaines qui n'ont de sens que d'un côté (ex. un sujet de veille large comme "Éducation généraliste" n'est pas une catégorie de tâche actionnable). Les deux activés par défaut à la création ; les notes voient tous les domaines quel que soit leur usage.
- **Multi-domaines** (nouveau) : une tâche, une note ou un item de veille peut être tagué de plusieurs domaines à la fois (sélecteur à chips dans les formulaires, plusieurs badges affichés). Contrainte : tous les domaines d'un même item doivent être compatibles entre eux — un domaine "les deux" se combine librement avec n'importe quoi, mais on ne peut toujours pas mélanger un domaine strictement pro avec un domaine strictement perso sur le même item.
- **Domaine partagé Pro/Perso** (nouveau) : un domaine peut être marqué "les deux" (3e option à côté de Pro/Perso) plutôt que dupliqué en deux tags distincts — il apparaît alors dans les sélecteurs des deux contextes, et une tâche/note/item de veille taguée uniquement avec un domaine "les deux" est visible des deux côtés. Les sources de veille restent en revanche strictement Pro ou Perso (portée jugée hors périmètre, comme pour le multi-domaines).
- **Ajout/retrait rapide de tag depuis la carte** (nouveau) : bouton "+ tag" (pointillé) à côté des badges de domaine sur chaque carte de tâche (écran Aujourd'hui) et dans le volet détail d'une note — ouvre une rangée de chips à bascule sans passer par le formulaire d'édition complet, application immédiate.

## Onglet Veille (séparé, par domaine)
- Items groupés par domaine, affichés en cartes (même style visuel que les tâches d'Aujourd'hui), avec un résumé du lien (nouveau champ `apercu`) — un item multi-domaines apparaît dans chacun des groupes concernés
- 3 actions rapides par item : ignorer / garder pour lecture (→ envoyé automatiquement vers l'onglet Notes) / transformer en tâche
- **Filtre par domaine** (nouveau), sélection unique ou multiple
- **Actualisation automatique** de la liste à 7h et 20h (nouveau), tant que l'écran reste ouvert dans le navigateur — ne déclenche pas de vraie collecte, relit simplement les données actuelles
- **Sources de veille** (nouveau) : panneau "⚙️ Sources" pour ajouter/désactiver/supprimer les sources à interroger, taguées Pro ou Perso — inspiré de `uneIAparjour/veille-agregateurs`
- **Ingestion automatisée** : collecte réelle des flux RSS/Atom (feedparser), déclenchée par un workflow GitHub Actions planifié — limitée aux flux RSS/Atom, pas de scraping générique ni d'API tierces (voir État d'implémentation)
  - Veille Pro : tous les matins avant 7h30
  - Veille Perso : tous les soirs à 20h
- **Date de publication d'origine** (nouveau) : chaque carte affiche la date de publication fournie par le flux RSS/Atom (extraite par feedparser à l'ingestion), plutôt que la date de collecte par notre serveur. Repli sur la date de collecte si le flux n'expose aucune date d'origine (certains flux n'en fournissent pas).

## Onglet Notes
- **Vue à deux volets façon Notes d'Apple** (nouveau) : colonne de gauche compacte avec uniquement le titre de chaque note pour défiler vite, volet de droite avec le détail complet de la note sélectionnée. Sur mobile, un seul volet visible à la fois (liste, puis détail en plein écran au clic, avec bouton "← Retour") ; sur desktop (≥900px) les deux volets restent côte à côte par défaut, avec deux boutons dans l'en-tête pour masquer la colonne (détail plein écran) ou au contraire n'afficher que la colonne (liste plein écran) — sélectionner une note dans ce dernier mode revient automatiquement à la vue partagée
- **Unique et filtrable par tag**, avec un filtre supplémentaire "Sans tag" (nouveau)
- **Filtrage par contexte Pro/Perso** (nouveau) : la liste suit le sélecteur Pro/Perso global, filtré via les domaines associés à chaque note (au moins un domaine du bon contexte suffit). Une note sans tag n'a pas de contexte déterminable et reste **toujours visible des deux côtés**, plutôt que masquée arbitrairement d'un côté
- **Date d'ajout affichée** (nouveau) : "Ajoutée le [date]" dans le volet détail, basée sur le moment de création de la note (à distinguer de la date de publication affichée côté Veille pour les items collectés)
- **Badge d'alerte visuel** ("⚠ Sans tag", nouveau) sur toute note sans domaine, pour éviter qu'elle passe inaperçue
- Import manuel : champ "coller un lien" avec récupération auto du titre/aperçu
- **Éditeur de texte markdown** (nouveau) avec barre d'outils (titres, gras, italique, barré, code, listes, case à cocher, citation, lien, ligne horizontale) et bascule aperçu/édition, pour rédiger des notes de texte libres et pas seulement importer des liens
- **Pièces jointes** (nouveau) : upload de fichier ou image par note (10 Mo max), miniature pour les images, téléchargement, suppression
- **Export** (nouveau) de chaque note en `.txt`, `.md` ou `.docx`
- **Sélection multiple** (nouveau) : suppression en masse, ajout de tag en masse (s'ajoute aux domaines déjà présents sur chaque note plutôt que de les remplacer), partage groupé
- **Fusion de plusieurs notes** (nouveau, depuis la sélection multiple, ≥2 notes) : "Fusionner en note" consolide le contenu (blocs concaténés en ordre chronologique), les domaines et les pièces jointes en une seule note, puis supprime les notes d'origine (confirmation demandée — vraie fusion, pas une copie) ; "Fusionner en tâche" fait la même consolidation vers une nouvelle tâche sans toucher aux notes d'origine, cohérent avec le comportement non destructif de la transformation d'une note unique. Titre personnalisable ou auto-généré. Les notes sélectionnées doivent être du même contexte Pro/Perso.
- Alimentation automatique par l'action "garder pour lecture" de l'onglet Veille (tous les domaines de l'item de veille sont hérités automatiquement, idem pour "transformer en tâche")
- **Partage externe sortant** : ⚠️ implémenté via l'API Web Share native du navigateur (`navigator.share`), qui ouvre le menu de partage natif macOS/iOS — au lieu du raccourci Apple Shortcuts unique synchronisé via iCloud initialement prévu. Repli automatique sur copie presse-papiers si l'API n'est pas disponible
- **Capture externe entrante** : ✅ raccourci Apple Shortcuts (menu Partager, authentifié via une clé API dédiée) et favori Chrome/bookmarklet (authentifié via la session déjà connectée, sans clé exposée) — voir [raccourci-partage.md](./raccourci-partage.md)

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
