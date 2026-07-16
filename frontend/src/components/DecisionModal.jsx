import { useState } from "react";

const ACTIONS_STANDARD = [
  { value: "reporter_demain", label: "Reporter à demain" },
  { value: "reporter_date", label: "Reporter à une date" },
  { value: "abandonner", label: "Abandonner" },
];

const ACTIONS_ANTI_OUBLI = [
  { value: "garder", label: "Garder telle quelle" },
  { value: "reprioriser", label: "Reprioriser" },
  { value: "abandonner", label: "Abandonner" },
];

const PRIORITES = [
  { value: "un_jour", label: "Un jour" },
  { value: "cette_semaine", label: "Cette semaine" },
  { value: "aujourd_hui", label: "Aujourd'hui" },
];

export default function DecisionModal({ tache, raison, onDecide, onClose }) {
  const options = raison === "anti_oubli" ? ACTIONS_ANTI_OUBLI : ACTIONS_STANDARD;
  const [action, setAction] = useState(options[0].value);
  const [date, setDate] = useState("");
  const [priorite, setPriorite] = useState("cette_semaine");

  function valider() {
    const decision = { action };
    if (action === "reporter_date") decision.nouvelle_date = date;
    if (action === "reprioriser") decision.nouvelle_priorite = priorite;
    onDecide(decision);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{tache.titre}</h3>
        {raison === "anti_oubli" && (
          <p className="modal-note">
            Cette tâche n'a pas été touchée depuis 7 jours. Une décision est nécessaire — pas de
            report possible sur ce cas.
          </p>
        )}
        {raison !== "anti_oubli" && <p>Cette tâche n'a pas été réalisée. Que faire ?</p>}

        <div className="modal-options">
          {options.map((o) => (
            <label key={o.value}>
              <input
                type="radio"
                name="action"
                value={o.value}
                checked={action === o.value}
                onChange={() => setAction(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>

        {action === "reporter_date" && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}

        {action === "reprioriser" && (
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            {PRIORITES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        <div className="modal-buttons">
          <button onClick={onClose}>Annuler</button>
          <button onClick={valider} disabled={action === "reporter_date" && !date}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
