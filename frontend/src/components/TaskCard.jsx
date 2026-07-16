import Pomodoro from "./Pomodoro.jsx";

const LABELS_PRIORITE = {
  un_jour: "Un jour",
  cette_semaine: "Cette semaine",
  aujourd_hui: "Aujourd'hui",
};

const LABELS_RAISON = {
  score: "Priorité du jour",
  epingle: "Épinglée",
  report_remonte: "Reportée hier",
  anti_oubli: "Oubliée depuis 7 jours",
  remontee_auto: "Remontée automatiquement",
  recurrente: "🔁 Récurrente",
};

export default function TaskCard({ tache, raison, onEpingleToggle, onRecurrenteToggle, onRealiser, children }) {
  return (
    <article className="task-card">
      <div className="task-card-header">
        {raison && <span className="badge">{LABELS_RAISON[raison]}</span>}
        <h3>{tache.titre}</h3>
      </div>
      <p className="task-meta">
        {tache.domaine.nom} · {LABELS_PRIORITE[tache.priorite]}
        {tache.date_fin && ` · échéance ${tache.date_fin}`}
      </p>
      {tache.description && <p className="task-description">{tache.description}</p>}

      <div className="task-actions">
        {onRealiser && (
          <button className="bouton-icone" onClick={() => onRealiser(tache)} title="Réalisé" aria-label="Réalisé">
            ✓
          </button>
        )}
        {onEpingleToggle && (
          <button
            className={tache.epinglee ? "bouton-icone actif" : "bouton-icone"}
            onClick={() => onEpingleToggle(tache)}
            title={tache.epinglee ? "Désépingler" : "Épingler"}
            aria-label={tache.epinglee ? "Désépingler" : "Épingler"}
          >
            📌
          </button>
        )}
        {onRecurrenteToggle && (
          <button
            className={tache.recurrente ? "bouton-icone actif" : "bouton-icone"}
            onClick={() => onRecurrenteToggle(tache)}
            title={tache.recurrente ? "Rendre classique" : "Rendre récurrente"}
            aria-label={tache.recurrente ? "Rendre classique" : "Rendre récurrente"}
          >
            🔁
          </button>
        )}
        {tache.type === "administrative" && <Pomodoro />}
      </div>

      {children}
    </article>
  );
}
