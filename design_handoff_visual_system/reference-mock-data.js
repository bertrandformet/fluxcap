export const domains = [
  { id: 'form', name: 'Cours & préparation', ctx: 'pro' },
  { id: 'pilot', name: 'Réunions & pilotage', ctx: 'pro' },
  { id: 'admin', name: 'Administratif', ctx: 'pro' },
  { id: 'maison', name: 'Maison', ctx: 'perso' },
  { id: 'sante', name: 'Santé', ctx: 'perso' },
  { id: 'veille', name: 'Veille tech', ctx: 'perso' },
];

export const tasksToday = [
  { id: 1, title: 'Préparer le support de formation Excel', domain: 'Cours & préparation', priority: 'Aujourd’hui', due: 'dans 2 jours', pinned: false, recurring: false, admin: false, reported: false, done: false },
  { id: 2, title: 'Relire le compte-rendu de pilotage', domain: 'Réunions & pilotage', priority: 'Cette semaine', due: 'dans 4 jours', pinned: false, recurring: false, admin: false, reported: false, done: false },
  { id: 3, title: 'Répondre aux 3 mails en attente', domain: 'Administratif', priority: 'Aujourd’hui', due: 'aujourd’hui', pinned: false, recurring: false, admin: true, reported: true, done: false },
  { id: 4, title: 'Préparer les questions pour l’entretien', domain: 'Cours & préparation', priority: 'Cette semaine', due: 'dans 5 jours', pinned: true, recurring: false, admin: false, reported: false, done: false },
];

export const tasksRecurring = [
  { id: 5, title: 'Vérifier les indicateurs qualité', domain: 'Réunions & pilotage' },
  { id: 6, title: 'Faire 20 minutes d’exercice', domain: 'Santé' },
];

export const veillePreview = [
  { id: 1, title: 'Nouveau référentiel de compétences publié', domain: 'Veille tech' },
  { id: 2, title: 'Retour d’expérience : formation hybride', domain: 'Cours & préparation' },
];

export const veilleItems = [
  { id: 1, domain: 'Veille tech', title: 'Nouveau référentiel de compétences publié', source: 'DNE', apercu: 'Une mise à jour du référentiel numérique, avec un focus sur l’IA en classe.' },
  { id: 2, domain: 'Veille tech', title: 'Retours d’usage sur les outils d’IA générative', source: 'DINUM', apercu: 'Synthèse de plusieurs académies sur l’adoption des outils d’IA en 2026.' },
  { id: 3, domain: 'Cours & préparation', title: 'Retour d’expérience : formation hybride', source: 'Blog pédagogique', apercu: 'Un enseignant partage son organisation pour alterner présentiel et distanciel.' },
  { id: 4, domain: 'Maison', title: 'Comparatif des solutions de domotique 2026', source: 'Les Numériques', apercu: 'Un tour d’horizon des box domotiques compatibles Matter.' },
];

export const notes = [
  { id: 1, title: 'Idées pour la formation Excel', domain: 'Cours & préparation', tag: true, updated: 'hier' },
  { id: 2, title: 'Lien : comparatif domotique', domain: 'Maison', tag: true, updated: 'il y a 2 jours' },
  { id: 3, title: 'Notes de la réunion de pilotage', domain: 'Réunions & pilotage', tag: true, updated: 'il y a 3 jours' },
  { id: 4, title: 'Sans titre', domain: null, tag: false, updated: 'il y a 5 jours' },
];

export const dashboardByDomain = [
  { domain: 'Cours & préparation', count: 4, total: 9 },
  { domain: 'Réunions & pilotage', count: 2, total: 9 },
  { domain: 'Administratif', count: 1, total: 9 },
  { domain: 'Maison', count: 1, total: 9 },
  { domain: 'Santé', count: 1, total: 9 },
];

export const dashboardByPriority = [
  { priority: 'Aujourd’hui', count: 3, total: 9 },
  { priority: 'Cette semaine', count: 4, total: 9 },
  { priority: 'Un jour', count: 2, total: 9 },
];
