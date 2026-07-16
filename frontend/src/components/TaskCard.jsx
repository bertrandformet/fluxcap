import { useState } from "react";
import Pomodoro from "./Pomodoro.jsx";
import DomainBadge from "./DomainBadge.jsx";
import { IconCheck, IconLoop, IconPin, IconTomato } from "./Icons.jsx";

const LABELS_PRIORITE = {
  un_jour: "Un jour",
  cette_semaine: "Cette semaine",
  aujourd_hui: "Aujourd'hui",
};

const LABELS_RAISON = {
  score: "Priorité du jour",
  epingle: "Épinglée",
  report_remonte: "Reportée d'hier",
  anti_oubli: "Oubliée depuis 7 jours",
  remontee_auto: "Remontée automatiquement",
  recurrente: "Récurrente",
};

export default function TaskCard({ tache, raison, onEpingleToggle, onRecurrenteToggle, onRealiser, dense, children }) {
  const [pomodoroOuvert, setPomodoroOuvert] = useState(false);
  const badgeClass = raison === "anti_oubli" ? "tnv-badge tnv-badge--warning" : "tnv-badge tnv-badge--accent";

  return (
    <article className={dense ? "tnv-task-card tnv-task-card--dense" : "tnv-card tnv-task-card"}>
      {onRealiser && (
        <button className="tnv-icon-btn" onClick={() => onRealiser(tache)} title="Réalisé" aria-label="Réalisé" style={{ marginTop: 1 }}>
          <IconCheck />
        </button>
      )}

      <div className="tnv-task-card__body">
        <span className="tnv-task-card__title">{tache.titre}</span>
        <div className="tnv-task-card__meta">
          <DomainBadge domaine={tache.domaine} />
          <span className="tnv-meta-text">
            {LABELS_PRIORITE[tache.priorite]}
            {tache.date_fin && ` · échéance ${tache.date_fin}`}
          </span>
          {raison && <span className={badgeClass}>{LABELS_RAISON[raison]}</span>}
        </div>
        {tache.description && <p className="tnv-meta-text">{tache.description}</p>}
        {children}
      </div>

      <div className="tnv-task-card__actions">
        {tache.type === "administrative" && (
          <button className="tnv-icon-btn" onClick={() => setPomodoroOuvert(true)} title="Démarrer un focus" aria-label="Démarrer un focus">
            <IconTomato />
          </button>
        )}
        {onRecurrenteToggle && (
          <button
            className={tache.recurrente ? "tnv-icon-btn tnv-icon-btn--active" : "tnv-icon-btn"}
            onClick={() => onRecurrenteToggle(tache)}
            title={tache.recurrente ? "Rendre classique" : "Rendre récurrente"}
            aria-label={tache.recurrente ? "Rendre classique" : "Rendre récurrente"}
          >
            <IconLoop />
          </button>
        )}
        {onEpingleToggle && (
          <button
            className={tache.epinglee ? "tnv-icon-btn tnv-icon-btn--active" : "tnv-icon-btn"}
            onClick={() => onEpingleToggle(tache)}
            title={tache.epinglee ? "Désépingler" : "Épingler"}
            aria-label={tache.epinglee ? "Désépingler" : "Épingler"}
          >
            <IconPin filled={tache.epinglee} />
          </button>
        )}
      </div>

      {pomodoroOuvert && <Pomodoro tache={tache} onClose={() => setPomodoroOuvert(false)} />}
    </article>
  );
}
