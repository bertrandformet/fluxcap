import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import TaskCard from "../components/TaskCard.jsx";
import DecisionModal from "../components/DecisionModal.jsx";

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

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!jour) return <p>Chargement…</p>;

  const enAttente = jour.selection.filter((s) => s.statut_jour === "en_attente");
  const traitees = jour.selection.filter((s) => s.statut_jour !== "en_attente");
  const nbFait = jour.selection.filter((s) => s.statut_jour === "realise").length;
  const nbReporte = jour.selection.filter((s) => s.statut_jour === "reporte").length;

  return (
    <section>
      <h2>Clôture du jour</h2>
      <p className="compteur">
        {nbFait} réalisée(s) · {nbReporte} reportée(s)
      </p>

      {enAttente.length === 0 && <p>Toutes les tâches du jour ont été traitées.</p>}

      <div className="task-list">
        {enAttente.map((s) => (
          <TaskCard key={s.id} tache={s.tache} raison={s.raison_selection}>
            <div className="cloture-actions">
              <button className="bouton-icone" onClick={() => marquerRealise(s)} title="Réalisée" aria-label="Réalisée">
                ✓
              </button>
              <button onClick={() => setEnDecision(s)}>
                {s.raison_selection === "anti_oubli" ? "Décider" : "À réaliser"}
              </button>
            </div>
          </TaskCard>
        ))}
      </div>

      {traitees.length > 0 && (
        <div className="traitees">
          <h3>Déjà traitées</h3>
          <ul>
            {traitees.map((s) => (
              <li key={s.id}>
                {s.tache.titre} — {s.statut_jour}
              </li>
            ))}
          </ul>
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
    </section>
  );
}
