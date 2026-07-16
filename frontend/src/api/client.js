const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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

async function telechargerFichier(path, nomParDefaut) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
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

export const api = {
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
    const res = await fetch(`${BASE_URL}/notes/${noteId}/pieces-jointes`, { method: "POST", body: formData });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status} ${res.statusText} — ${detail}`);
    }
    return res.json();
  },
  supprimerPieceJointe: (id) => request(`/notes/pieces-jointes/${id}`, { method: "DELETE" }),
  urlPieceJointe: (id) => `${BASE_URL}/notes/pieces-jointes/${id}/fichier`,
  telechargerPieceJointe: (id, nom) => telechargerFichier(`/notes/pieces-jointes/${id}/fichier`, nom),
  getParametres: () => request(`/parametres`),
  modifierParametres: (patch) => request(`/parametres`, { method: "PUT", body: JSON.stringify(patch) }),
  getSourcesVeille: (contexte) => request(`/sources-veille${contexte ? `?contexte=${contexte}` : ""}`),
  creerSourceVeille: (source) => request(`/sources-veille`, { method: "POST", body: JSON.stringify(source) }),
  modifierSourceVeille: (id, patch) => request(`/sources-veille/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  supprimerSourceVeille: (id) => request(`/sources-veille/${id}`, { method: "DELETE" }),
};
