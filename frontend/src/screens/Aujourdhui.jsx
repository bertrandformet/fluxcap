import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import TaskCard from "../components/TaskCard.jsx";
import { IconCheck } from "../components/Icons.jsx";

const PRIORITES = [
  { value: "un_jour", label: "Un jour" },
  { value: "cette_semaine", label: "Cette semaine" },
  { value: "aujourd_hui", label: "Aujourd'hui" },
];

export default function Aujourdhui({ contexte, congesActif, onNaviguerVeille }) {
  const [jour, setJour] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [domaines, setDomaines] = useState([]);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [titre, setTitre] = useState("");
  const [domaineIds, setDomaineIds] = useState(new Set());
  const [priorite, setPriorite] = useState("un_jour");
  const [dateFin, setDateFin] = useState("");
  const [administrative, setAdministrative] = useState(false);
  const [recurrente, setRecurrente] = useState(false);
  const [epinglee, setEpinglee] = useState(false);

  useEffect(() => {
    charger();
    api.getDomaines(contexte, "taches").then(setDomaines).catch((e) => setErreur(e.message));
  }, [contexte]);

  function charger() {
    setJour(null);
    api.getJour(contexte).then(setJour).catch((e) => setErreur(e.message));
  }

  async function basculerEpingle(tache) {
    await api.updateTache(tache.id, { epinglee: !tache.epinglee });
    charger();
  }

  async function basculerRecurrente(tache) {
    await api.updateTache(tache.id, { recurrente: !tache.recurrente });
    charger();
  }

  async function marquerRealise(selection) {
    await api.cloturerTache(contexte, selection.id, { action: "realiser" });
    charger();
  }

  async function annulerRealisation(selection) {
    await api.cloturerTache(contexte, selection.id, { action: "annuler_realisation" });
    charger();
  }

  async function supprimerTache(tache) {
    await api.supprimerTache(tache.id);
    charger();
  }

  async function modifierDomainesTache(tache, domaineIds) {
    try {
      await api.updateTache(tache.id, { domaine_ids: domaineIds });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function basculerDomaineFormulaire(id) {
    setDomaineIds((s) => {
      const nouveau = new Set(s);
      if (nouveau.has(id)) nouveau.delete(id);
      else nouveau.add(id);
      return nouveau;
    });
  }

  async function creerTache(e) {
    e.preventDefault();
    if (!titre.trim() || domaineIds.size === 0) return;
    try {
      await api.creerTache({
        titre,
        domaine_ids: [...domaineIds],
        priorite,
        date_fin: dateFin || null,
        type: administrative ? "administrative" : "standard",
        recurrente,
        epinglee,
      });
      setTitre("");
      setDomaineIds(new Set());
      setPriorite("un_jour");
      setDateFin("");
      setAdministrative(false);
      setRecurrente(false);
      setEpinglee(false);
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (erreur) return <p className="tnv-error">{erreur}</p>;
  if (!jour) return <p className="tnv-empty">Chargement…</p>;

  const enPauseConges = contexte === "pro" && congesActif;

  const enAttente = jour.selection.filter((s) => s.statut_jour === "en_attente");
  const principalesBrutes = enAttente.filter((s) => s.raison_selection !== "recurrente");
  const recurrentes = enAttente.filter((s) => s.raison_selection === "recurrente");
  const realisees = jour.selection.filter((s) => s.statut_jour === "realise");

  // Pendant les congés, une tâche Pro épinglée ne force plus sa place en tête : elle redescend.
  const principales = enPauseConges
    ? [...principalesBrutes].sort((a, b) => (a.raison_selection === "epingle" ? 1 : 0) - (b.raison_selection === "epingle" ? 1 : 0))
    : principalesBrutes;

  return (
    <div className="tnv-screen">
      <div className="tnv-screen-head">
        <div>
          <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
          <h1 className="tnv-h1">Aujourd'hui</h1>
          <p className="tnv-meta-text">
            {principales.length} tâche(s){enPauseConges && " · Pro en pause (congés)"}
          </p>
        </div>
        <button className="tnv-btn tnv-btn--secondary" onClick={() => setFormulaireOuvert((o) => !o)}>
          {formulaireOuvert ? "✕ Fermer" : "+ Tâche"}
        </button>
      </div>

      {formulaireOuvert && (
        <form className="tnv-form" onSubmit={creerTache}>
          <input className="tnv-input" type="text" placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {domaines.map((d) => (
              <button
                key={d.id}
                type="button"
                className={domaineIds.has(d.id) ? "tnv-chip tnv-chip--active" : "tnv-chip"}
                onClick={() => basculerDomaineFormulaire(d.id)}
              >
                {d.nom}
              </button>
            ))}
          </div>
          <div className="tnv-field-row">
            <select className="tnv-select" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
              {PRIORITES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input className="tnv-input" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </div>
          <label className="tnv-checkbox-row">
            <input type="checkbox" checked={administrative} onChange={(e) => setAdministrative(e.target.checked)} />
            Administrative (active le Pomodoro)
          </label>
          <label className="tnv-checkbox-row">
            <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} />
            Récurrente
          </label>
          <label className="tnv-checkbox-row">
            <input type="checkbox" checked={epinglee} onChange={(e) => setEpinglee(e.target.checked)} />
            Épinglée
          </label>
          <button type="submit" className="tnv-btn tnv-btn--primary">
            Créer la tâche
          </button>
        </form>
      )}

      {principales.length === 0 && <p className="tnv-empty">Rien à traiter aujourd'hui.</p>}

      <div className={enPauseConges ? "tnv-stack tnv-grisees" : "tnv-stack"}>
        {principales.map((s) => (
          <TaskCard
            key={s.id}
            tache={s.tache}
            raison={s.raison_selection}
            onEpingleToggle={basculerEpingle}
            onRecurrenteToggle={basculerRecurrente}
            onRealiser={() => marquerRealise(s)}
            onSupprimer={supprimerTache}
            domainesDisponibles={domaines}
            onDomainesChange={modifierDomainesTache}
          />
        ))}
      </div>

      {realisees.length > 0 && (
        <div className="tnv-card" style={{ marginBottom: "var(--tnv-space-6)" }}>
          <span className="tnv-section-label">Réalisées aujourd'hui</span>
          <div className="tnv-stack" style={{ marginTop: 10, marginBottom: 0 }}>
            {realisees.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IconCheck filled size={18} />
                <span className="tnv-task-card__title tnv-task-card__title--done" style={{ flex: 1 }}>
                  {s.tache.titre}
                </span>
                <button
                  className="tnv-btn tnv-btn--ghost"
                  onClick={() => annulerRealisation(s)}
                  title="Remettre dans les tâches en cours"
                >
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={enPauseConges ? "tnv-card tnv-card--dashed tnv-grisees" : "tnv-card tnv-card--dashed"}>
        <span className="tnv-section-label">Récurrentes &amp; veille · hors quota</span>

        {recurrentes.length === 0 && jour.veille_a_traiter.length === 0 ? (
          <p className="tnv-empty" style={{ marginTop: 10 }}>
            Aucune tâche récurrente.
          </p>
        ) : (
          <>
            {recurrentes.length > 0 && (
              <div className="tnv-stack" style={{ marginTop: 10, marginBottom: recurrentes.length ? 10 : 0 }}>
                {recurrentes.map((s) => (
                  <TaskCard
                    key={s.id}
                    dense
                    tache={s.tache}
                    raison={s.raison_selection}
                    onEpingleToggle={basculerEpingle}
                    onRecurrenteToggle={basculerRecurrente}
                    onRealiser={() => marquerRealise(s)}
                    onSupprimer={supprimerTache}
                    domainesDisponibles={domaines}
                    onDomainesChange={modifierDomainesTache}
                  />
                ))}
              </div>
            )}
            {jour.veille_a_traiter.length > 0 && (
              <button
                className="tnv-btn tnv-btn--ghost"
                style={{ alignSelf: "flex-start", paddingLeft: 0 }}
                onClick={onNaviguerVeille}
              >
                {jour.veille_a_traiter.length} nouveaux articles en veille →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
