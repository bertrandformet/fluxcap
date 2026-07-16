import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import TaskCard from "../components/TaskCard.jsx";

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
  const [domaineId, setDomaineId] = useState("");
  const [priorite, setPriorite] = useState("un_jour");
  const [dateFin, setDateFin] = useState("");
  const [administrative, setAdministrative] = useState(false);
  const [recurrente, setRecurrente] = useState(false);
  const [epinglee, setEpinglee] = useState(false);

  useEffect(() => {
    charger();
    api.getDomaines(contexte).then(setDomaines).catch((e) => setErreur(e.message));
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

  async function creerTache(e) {
    e.preventDefault();
    if (!titre.trim() || !domaineId) return;
    try {
      await api.creerTache({
        titre,
        domaine_id: Number(domaineId),
        priorite,
        date_fin: dateFin || null,
        type: administrative ? "administrative" : "standard",
        recurrente,
        epinglee,
      });
      setTitre("");
      setDomaineId("");
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

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!jour) return <p>Chargement…</p>;

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
    <section>
      <h2>
        Aujourd'hui — {principales.length} tâche(s)
        {enPauseConges && " · Pro en pause (congés)"}
      </h2>

      <button className="bouton-nouvelle-tache" onClick={() => setFormulaireOuvert((o) => !o)}>
        {formulaireOuvert ? "✕" : "+ Tâche"}
      </button>

      {formulaireOuvert && (
        <form className="import-lien" onSubmit={creerTache}>
          <input type="text" placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <select value={domaineId} onChange={(e) => setDomaineId(e.target.value)}>
            <option value="">Domaine…</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            {PRIORITES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <label>
            Échéance :
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={administrative} onChange={(e) => setAdministrative(e.target.checked)} />
            Administrative (active le Pomodoro)
          </label>
          <label>
            <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} />
            Récurrente
          </label>
          <label>
            <input type="checkbox" checked={epinglee} onChange={(e) => setEpinglee(e.target.checked)} />
            Épinglée
          </label>
          <button type="submit" className="bouton-icone" title="Créer la tâche" aria-label="Créer la tâche">
            ✓
          </button>
        </form>
      )}

      {principales.length === 0 && <p>Rien à traiter aujourd'hui.</p>}

      <div className={enPauseConges ? "task-list taches-grisees" : "task-list"}>
        {principales.map((s) => (
          <TaskCard
            key={s.id}
            tache={s.tache}
            raison={s.raison_selection}
            onEpingleToggle={basculerEpingle}
            onRecurrenteToggle={basculerRecurrente}
            onRealiser={() => marquerRealise(s)}
          />
        ))}
      </div>

      {realisees.length > 0 && (
        <div className="traitees">
          <h3>Réalisées aujourd'hui</h3>
          <ul>
            {realisees.map((s) => (
              <li key={s.id}>{s.tache.titre}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={enPauseConges ? "bloc-recurrentes taches-grisees" : "bloc-recurrentes"}>
        <h2>Récurrentes</h2>
        {recurrentes.length === 0 && jour.veille_a_traiter.length === 0 ? (
          <p>Aucune tâche récurrente.</p>
        ) : (
          <div className="task-list">
            {jour.veille_a_traiter.length > 0 && (
              <TaskCard
                tache={{
                  titre: "Traiter la veille du jour",
                  domaine: { nom: `${jour.veille_a_traiter.length} item(s) à traiter` },
                  priorite: "aujourd_hui",
                  date_fin: null,
                  type: "administrative",
                }}
                raison="epingle"
                onRealiser={onNaviguerVeille}
              />
            )}
            {recurrentes.map((s) => (
              <TaskCard
                key={s.id}
                tache={s.tache}
                raison={s.raison_selection}
                onEpingleToggle={basculerEpingle}
                onRecurrenteToggle={basculerRecurrente}
                onRealiser={() => marquerRealise(s)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
