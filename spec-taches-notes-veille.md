# Spécification — Application de gestion des tâches et de la veille

## Contexte
Application personnelle et privée destinée à remplacer les outils précédents (Notion, Todoist...) qui n'ont pas tenu dans la durée, faute de rituel quotidien stable et à cause de la friction d'usage. Le design s'appuie sur des résultats de recherche en psychologie cognitive et en neurosciences (intentions d'implémentation, effet Zeigarnik, limite de la mémoire de travail à ~4 éléments, formation des habitudes via les ganglions de la base).

## Architecture générale
- **PWA multiplateforme** (web, mobile iOS/Android, desktop) — un seul code
- **Stack** : React (frontend) + FastAPI (backend), choisie pour la maintenabilité
- **Hébergement gratuit** : Vercel (frontend) + Render (backend, cold start toléré). Repli possible : serveur OVH personnel existant (utilisé pour uneIAparjour.fr)
- **Repo public** avec données factices/exemples ; vraies données et configuration dans `.env` ignoré par git, jamais commité
- **Authentification** : mot de passe classique ET Face ID/Touch ID (WebAuthn/passkey), les deux disponibles au choix
- **Approche de développement** : POC fonctionnel d'abord dans Claude Code (logique et données), habillage visuel ensuite via Claude Design une fois le code existant, avec handoff retour vers Claude Code

## Deux onglets séparés : Pro / Perso
Pas un simple filtre — deux contextes distincts, chacun avec son propre rituel matin/soir.

### Planning des notifications
| Jour | Pro | Perso |
|---|---|---|
| Lun–Ven | 7h30 (ouverture) + 17h30 (clôture) | 21h (ouverture) + 7h (clôture, juste avant Pro) |
| Sam–Dim | — | 9h (ouverture) + 21h (clôture) |

### Mode congés
Statut activable/désactivable ("Je suis en congés"). Tant qu'actif : bascule sur le rythme week-end (9h/21h Perso) tous les jours, aucune notification Pro. Pas de date de fin à saisir — se désactive manuellement.

## Écran "Aujourd'hui" (ouverture)
- **3-4 tâches maximum affichées** (limite de la mémoire de travail, Cowan ~4 chunks)
- Sélection par score = priorité × urgence (jours avant échéance)
- Les tâches reportées la veille remontent automatiquement en premier
- Épinglage manuel possible pour forcer une tâche dans le quota du jour
- **Veille toujours visible séparément**, jamais en concurrence avec les 3-4 tâches — bloc fixe "Traiter la veille du jour"
- **Mécanisme anti-oubli** : une tâche jamais touchée depuis 14 jours est forcée une fois dans les 3-4, avec décision obligatoire (garder / reprioriser / abandonner), pas de report possible sur ce cas

## Écran de clôture (soir)
- Liste des tâches du jour avec statut fait/pas fait
- Pour chaque tâche non faite : décision explicite obligatoire (reporter à demain / reporter à une date / abandonner) — jamais de report silencieux par défaut
- Compteur simple fait/reporté, **sans notion de streak ni de dette**
- Formulation toujours positive ("traiter X"), jamais culpabilisante

## Modèle de tâche
| Champ | Détail |
|---|---|
| Titre | texte libre |
| Domaine/source | Pro (DGESCO, DNE, DINUM, INRIA, Lab'IA, projets internes...) ou Perso (uneIAparjour) |
| Type | manuel — valeur "administrative" active le bouton Pomodoro |
| Priorité | 3-4 niveaux max (ex. aujourd'hui / cette semaine / un jour) |
| Date de fin | avec jalons intermédiaires optionnels si tâche longue |
| Date d'événement + délai de préparation | pour tâches liées à un événement fixe (ex. "préparer formation X") — distinct de la date de fin, surface automatiquement selon le délai configuré |
| Sous-tâches | optionnelles, suggérées automatiquement si échéance > 5-7 jours ou texte de description long — jamais systématique |
| Historique de report | dates de report successives, utile pour repérer les tâches qui traînent |

## Onglet Veille (séparé, par domaine)
- Items groupés par domaine (Pro : DGESCO, DNE, DINUM, INRIA, Lab'IA... / Perso : uneIAparjour exclusivement)
- 3 actions rapides par item : ignorer / garder pour lecture (→ envoyé automatiquement vers l'onglet Notes) / transformer en tâche
- **Ingestion automatisée** : migration de `fetch_tools.py` en job planifié
  - Veille Pro : tous les matins avant 7h30
  - Veille Perso (uneIAparjour) : tous les soirs à 20h

## Onglet Notes
- **Unique et filtrable par tag** (pas séparé Pro/Perso — les tags de domaine suffisent à s'y retrouver)
- Import manuel : champ "coller un lien" avec récupération auto du titre/aperçu
- Alimentation automatique par l'action "garder pour lecture" de l'onglet Veille (tag de domaine hérité automatiquement)
- **Partage externe** : raccourci Apple Shortcuts unique (iPhone + Mac, synchronisé via iCloud), apparaît dans le menu Partager natif de LinkedIn, Safari, etc.

## Pomodoro (optionnel)
- Bouton "Démarrer un focus" visible uniquement sur les tâches de type "administrative"
- Durée réglable (pas figée à 25/5)
- Pas de gamification ni de compteur de sessions accumulées

## Notes de recherche ayant guidé les choix de design
- **Intentions d'implémentation** ("si X, alors Y") : un seul déclencheur stable par comportement, pas plusieurs concurrents
- **Cadrage positif > évitement** : formuler les rappels en action, jamais en dette ; rater un jour n'a pas d'impact mesurable sur la trajectoire globale
- **Effet Zeigarnik** : un plan explicite de report referme la tension cognitive presque aussi bien que la tâche terminée — d'où la décision obligatoire au moment de la clôture
- **Mémoire de travail (Cowan)** : capacité réelle ~4 éléments, d'où la limite stricte de l'écran "Aujourd'hui"
- **Ganglions de la base / habitudes** : le transfert vers l'automatique dépend de la répétition du même déclencheur dans un contexte stable
- **Goal-setting theory (Locke & Latham)** : le découpage en sous-tâches proximales n'aide que si chaque sous-tâche est elle-même spécifique — d'où le découpage conditionnel, pas systématique
- **Pomodoro** : les pauses systématiques améliorent la concentration mais augmentent la fatigue plus vite et peuvent casser le flow sur du travail complexe — d'où sa restriction aux seules tâches administratives
