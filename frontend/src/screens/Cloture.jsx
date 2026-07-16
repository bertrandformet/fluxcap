import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import DecisionModal from "../components/DecisionModal.jsx";
import DomainBadge from "../components/DomainBadge.jsx";
import { IconCheck } from "../components/Icons.jsx";

const LABELS_STATUT = {
  realise: "Réalisée",
  reporte: "Reportée",
  abandonne: "Abandonnée",
};

export default function Cloture({ contexte }) {
  const [jour, setJour] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enDecision, setEnDecision] = useState(null);

  useEffect(() => {
    charger();
  }, [contexte]);

  function charger() {
    setJour(null);
    api.getJour(contexte).then(setJour).catch((e) => setErreur(e.message));
  }

  async function marquerRealise(selection) {
    await api.cloturerTache(contexte, selection.id, { action: "realiser" });
    charger();
  }

  async function appliquerDecision(decision) {
    await api.cloturerTache(contexte, enDecision.id, decision);
    setEnDecision(null);
    charger();
  }

  if (erreur) return <p className="tnv-error">{erreur}</p>;
  if (!jour) return <p className="tnv-empty">Chargement…</p>;

  const enAttente = jour.selection.filter((s) => s.statut_jour === "en_attente");
  const traitees = jour.selection.filter((s) => s.statut_jour !== "en_attente");
  const nbFait = jour.selection.filter((s) => s.statut_jour === "realise").length;
  const nbReporte = jour.selection.filter((s) => s.statut_jour === "reporte").length;

  return (
    <div className="tnv-screen">
      <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
      <h1 className="tnv-h1">Clôture</h1>
      <p className="tnv-meta-text" style={{ marginBottom: "var(--tnv-space-5)" }}>
        {nbFait} réalisée(s) · {nbReporte} reportée(s)
      </p>

      {enAttente.length === 0 && <p className="tnv-empty">Toutes les tâches du jour ont été traitées.</p>}

      <div className="tnv-stack">
        {enAttente.map((s) => (
          <div key={s.id} className="tnv-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="tnv-icon-btn" onClick={() => marquerRealise(s)} title="Réalisée" aria-label="Réalisée">
              <IconCheck />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tnv-task-card__title">{s.tache.titre}</div>
              <div className="tnv-task-card__meta" style={{ marginTop: 4 }}>
                <DomainBadge domaine={s.tache.domaine} />
              </div>
            </div>
            <button className="tnv-btn tnv-btn--outline" onClick={() => setEnDecision(s)}>
              {s.raison_selection === "anti_oubli" ? "Décider" : "À réaliser"}
            </button>
          </div>
        ))}
      </div>

      {traitees.length > 0 && (
        <div className="tnv-card">
          <span className="tnv-section-label">Déjà traitées</span>
          <div className="tnv-stack" style={{ marginTop: 10, marginBottom: 0 }}>
            {traitees.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IconCheck filled={s.statut_jour === "realise"} size={18} />
                <div>
                  <div
                    className={
                      s.statut_jour === "realise" ? "tnv-task-card__title tnv-task-card__title--done" : "tnv-task-card__title"
                    }
                  >
                    {s.tache.titre}
                  </div>
                  <span className="tnv-meta-text">{LABELS_STATUT[s.statut_jour]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enDecision && (
        <DecisionModal
          tache={enDecision.tache}
          raison={enDecision.raison_selection}
          onDecide={appliquerDecision}
          onClose={() => setEnDecision(null)}
        />
      )}
    </div>
  );
}
