const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

let jeton = localStorage.getItem("jeton_session") || null;
let gestionnaireSessionExpiree = null;

function definirJeton(nouveauJeton) {
  jeton = nouveauJeton;
  if (nouveauJeton) localStorage.setItem("jeton_session", nouveauJeton);
  else localStorage.removeItem("jeton_session");
}

function definirGestionnaireSessionExpiree(fn) {
  gestionnaireSessionExpiree = fn;
}

function enTetesAuth(base = {}) {
  return jeton ? { ...base, Authorization: `Bearer ${jeton}` } : base;
}

function signalerSessionExpiree() {
  definirJeton(null);
  if (gestionnaireSessionExpiree) gestionnaireSessionExpiree();
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: enTetesAuth({ "Content-Type": "application/json", ...(options.headers || {}) }),
  });
  if (res.status === 401) {
    signalerSessionExpiree();
    throw new Error("401 Session expirée");
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function nomFichierDepuisEntete(contentDisposition) {
  const match = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : null;
}

async function recupererBlob(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: enTetesAuth() });
  if (res.status === 401) {
    signalerSessionExpiree();
    throw new Error("401 Session expirée");
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
  return res;
}

async function telechargerFichier(path, nomParDefaut) {
  const res = await recupererBlob(path);
  const blob = await res.blob();
  const nom = nomFichierDepuisEntete(res.headers.get("Content-Disposition")) || nomParDefaut;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function obtenirUrlObjet(path) {
  const res = await recupererBlob(path);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const api = {
  definirJeton,
  definirGestionnaireSessionExpiree,
  estConnecte: () => Boolean(jeton),

  authStatut: () => request(`/auth/status`),
  authConfigurerMotDePasse: (mot_de_passe) =>
    request(`/auth/setup-mot-de-passe`, { method: "POST", body: JSON.stringify({ mot_de_passe }) }),
  authConnexion: (mot_de_passe) =>
    request(`/auth/login`, { method: "POST", body: JSON.stringify({ mot_de_passe }) }),
  authRecuperer: (code, nouveau_mot_de_passe) =>
    request(`/auth/recuperer`, { method: "POST", body: JSON.stringify({ code, nouveau_mot_de_passe }) }),
  authDeconnecterPartout: () => request(`/auth/deconnecter-partout`, { method: "POST" }),
  authRegenererCodeRecuperation: () => request(`/auth/regenerer-code-recuperation`, { method: "POST" }),
  authChangerMotDePasse: (mot_de_passe_actuel, nouveau_mot_de_passe) =>
    request(`/auth/changer-mot-de-passe`, {
      method: "POST",
      body: JSON.stringify({ mot_de_passe_actuel, nouveau_mot_de_passe }),
    }),

  webauthnOptionsInscription: (nom) =>
    request(`/auth/webauthn/inscription/options`, { method: "POST", body: JSON.stringify({ nom }) }),
  webauthnVerifierInscription: (nom, credential) =>
    request(`/auth/webauthn/inscription/verifier`, { method: "POST", body: JSON.stringify({ nom, credential }) }),
  webauthnOptionsAuthentification: () => request(`/auth/webauthn/authentification/options`, { method: "POST" }),
  webauthnVerifierAuthentification: (credential) =>
    request(`/auth/webauthn/authentification/verifier`, { method: "POST", body: JSON.stringify({ credential }) }),
  webauthnListerIdentifiants: () => request(`/auth/webauthn/identifiants`),
  webauthnSupprimerIdentifiant: (id) => request(`/auth/webauthn/identifiants/${id}`, { method: "DELETE" }),

  getJour: (contexte) => request(`/jour/${contexte}`),
  cloturerTache: (contexte, selectionId, decision) =>
    request(`/jour/${contexte}/cloture/${selectionId}`, {
      method: "POST",
      body: JSON.stringify(decision),
    }),
  creerTache: (tache) => request(`/taches`, { method: "POST", body: JSON.stringify(tache) }),
  getTaches: (contexte) => request(`/taches${contexte ? `?contexte=${contexte}` : ""}`),
  updateTache: (id, patch) => request(`/taches/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  getDomaines: (contexte) => request(`/domaines${contexte ? `?contexte=${contexte}` : ""}`),
  creerDomaine: (domaine) => request(`/domaines`, { method: "POST", body: JSON.stringify(domaine) }),
  modifierDomaine: (id, patch) => request(`/domaines/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  supprimerDomaine: (id) => request(`/domaines/${id}`, { method: "DELETE" }),
  getVeille: (params = {}) => request(`/veille?${new URLSearchParams(params)}`),
  agirVeille: (id, action) => request(`/veille/${id}/action`, { method: "POST", body: JSON.stringify({ action }) }),
  getNotes: (filtre) => {
    const params = new URLSearchParams();
    if (filtre === "sans_tag") params.set("sans_tag", "true");
    else if (filtre) params.set("domaine_id", filtre);
    const qs = params.toString();
    return request(`/notes${qs ? `?${qs}` : ""}`);
  },
  creerNote: (note) => request(`/notes`, { method: "POST", body: JSON.stringify(note) }),
  modifierNote: (id, patch) => request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  supprimerNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),
  noteVersTache: (id) => request(`/notes/${id}/transformer-tache`, { method: "POST" }),
  apercuLien: (url) => request(`/notes/apercu-lien?url=${encodeURIComponent(url)}`),
  exporterNote: (id, format) => telechargerFichier(`/notes/${id}/export?format=${format}`, `note.${format}`),
  ajouterPieceJointe: async (noteId, fichier) => {
    const formData = new FormData();
    formData.append("fichier", fichier);
    const res = await fetch(`${BASE_URL}/notes/${noteId}/pieces-jointes`, {
      method: "POST",
      headers: enTetesAuth(),
      body: formData,
    });
    if (res.status === 401) {
      signalerSessionExpiree();
      throw new Error("401 Session expirée");
    }
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status} ${res.statusText} — ${detail}`);
    }
    return res.json();
  },
  supprimerPieceJointe: (id) => request(`/notes/pieces-jointes/${id}`, { method: "DELETE" }),
  urlObjetPieceJointe: (id) => obtenirUrlObjet(`/notes/pieces-jointes/${id}/fichier`),
  telechargerPieceJointe: (id, nom) => telechargerFichier(`/notes/pieces-jointes/${id}/fichier`, nom),
  getParametres: () => request(`/parametres`),
  modifierParametres: (patch) => request(`/parametres`, { method: "PUT", body: JSON.stringify(patch) }),
  getSourcesVeille: (contexte) => request(`/sources-veille${contexte ? `?contexte=${contexte}` : ""}`),
  creerSourceVeille: (source) => request(`/sources-veille`, { method: "POST", body: JSON.stringify(source) }),
  modifierSourceVeille: (id, patch) => request(`/sources-veille/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  supprimerSourceVeille: (id) => request(`/sources-veille/${id}`, { method: "DELETE" }),
};
