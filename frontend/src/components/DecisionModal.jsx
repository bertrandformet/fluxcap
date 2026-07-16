import { useState } from "react";

const ACTIONS_STANDARD = [
  { value: "reporter_demain", label: "Reporter à demain", niveau: "primary" },
  { value: "reporter_date", label: "Reporter à une date", niveau: "secondary" },
  { value: "abandonner", label: "Abandonner", niveau: "tertiary" },
];

const ACTIONS_ANTI_OUBLI = [
  { value: "garder", label: "Garder telle quelle", niveau: "primary" },
  { value: "reprioriser", label: "Reprioriser", niveau: "secondary" },
  { value: "abandonner", label: "Abandonner", niveau: "tertiary" },
];

const PRIORITES = [
  { value: "un_jour", label: "Un jour" },
  { value: "cette_semaine", label: "Cette semaine" },
  { value: "aujourd_hui", label: "Aujourd'hui" },
];

const CLASSE_NIVEAU = {
  primary: "tnv-decision-option tnv-decision-option--primary",
  secondary: "tnv-decision-option tnv-decision-option--secondary",
  tertiary: "tnv-decision-option tnv-decision-option--tertiary",
};

export default function DecisionModal({ tache, raison, onDecide, onClose }) {
  const options = raison === "anti_oubli" ? ACTIONS_ANTI_OUBLI : ACTIONS_STANDARD;
  const [attenteDate, setAttenteDate] = useState(false);
  const [attentePriorite, setAttentePriorite] = useState(false);
  const [date, setDate] = useState("");
  const [priorite, setPriorite] = useState("cette_semaine");

  function choisir(valeur) {
    if (valeur === "reporter_date") {
      setAttenteDate(true);
      return;
    }
    if (valeur === "reprioriser") {
      setAttentePriorite(true);
      return;
    }
    onDecide({ action: valeur });
  }

  return (
    <div className="tnv-overlay tnv-sheet" onClick={onClose}>
      <div className="tnv-sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="tnv-sheet__grabber" />
        <span className="tnv-sheet__title">{tache.titre}</span>
        <p className="tnv-sheet__subtitle">
          {raison === "anti_oubli"
            ? "Cette tâche n'a pas été touchée depuis 7 jours. Une décision est nécessaire — pas de report possible sur ce cas."
            : "Cette tâche n'a pas été réalisée. Que faire ?"}
        </p>

        {!attenteDate &&
          !attentePriorite &&
          options.map((o) => (
            <button key={o.value} className={CLASSE_NIVEAU[o.niveau]} onClick={() => choisir(o.value)}>
              {o.label}
            </button>
          ))}

        {attenteDate && (
          <>
            <input type="date" className="tnv-input" value={date} onChange={(e) => setDate(e.target.value)} />
            <button
              className="tnv-decision-option tnv-decision-option--primary"
              disabled={!date}
              onClick={() => onDecide({ action: "reporter_date", nouvelle_date: date })}
            >
              Confirmer la date
            </button>
          </>
        )}

        {attentePriorite && (
          <>
            <select className="tnv-select" value={priorite} onChange={(e) => setPriorite(e.target.value)}>
              {PRIORITES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              className="tnv-decision-option tnv-decision-option--primary"
              onClick={() => onDecide({ action: "reprioriser", nouvelle_priorite: priorite })}
            >
              Confirmer la priorité
            </button>
          </>
        )}

        <button className="tnv-btn tnv-btn--ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
