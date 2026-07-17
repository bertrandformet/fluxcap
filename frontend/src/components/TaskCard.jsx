import { useState } from "react";
import { api } from "../api/client.js";
import Pomodoro from "./Pomodoro.jsx";
import DomainBadge from "./DomainBadge.jsx";
import { IconCheck, IconChevronDown, IconLoop, IconPin, IconTomato, IconTrash } from "./Icons.jsx";

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

function DetailsTache({ tache }) {
  const [sousTaches, setSousTaches] = useState(tache.sous_taches || []);
  const [jalons, setJalons] = useState(tache.jalons || []);
  const [nouvelleSousTache, setNouvelleSousTache] = useState("");
  const [nouveauJalonTitre, setNouveauJalonTitre] = useState("");
  const [nouveauJalonDate, setNouveauJalonDate] = useState("");
  const historique = tache.historique_reports || [];

  async function ajouterSousTache(e) {
    e.preventDefault();
    if (!nouvelleSousTache.trim()) return;
    const obj = await api.creerSousTache(tache.id, { titre: nouvelleSousTache.trim(), ordre: sousTaches.length });
    setSousTaches([...sousTaches, obj]);
    setNouvelleSousTache("");
  }

  async function basculerSousTache(st) {
    const obj = await api.basculerSousTache(st.id, !st.fait);
    setSousTaches(sousTaches.map((s) => (s.id === st.id ? obj : s)));
  }

  async function supprimerSousTache(id) {
    await api.supprimerSousTache(id);
    setSousTaches(sousTaches.filter((s) => s.id !== id));
  }

  async function ajouterJalon(e) {
    e.preventDefault();
    if (!nouveauJalonTitre.trim() || !nouveauJalonDate) return;
    const obj = await api.creerJalon(tache.id, { titre: nouveauJalonTitre.trim(), date: nouveauJalonDate });
    setJalons([...jalons, obj]);
    setNouveauJalonTitre("");
    setNouveauJalonDate("");
  }

  async function basculerJalon(j) {
    const obj = await api.basculerJalon(j.id, !j.fait);
    setJalons(jalons.map((x) => (x.id === j.id ? obj : x)));
  }

  async function supprimerJalon(id) {
    await api.supprimerJalon(id);
    setJalons(jalons.filter((j) => j.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      <div>
        {sousTaches.map((st) => (
          <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <button
              className="tnv-icon-btn"
              onClick={() => basculerSousTache(st)}
              title={st.fait ? "Marquer non fait" : "Marquer fait"}
              aria-label={st.fait ? "Marquer non fait" : "Marquer fait"}
              style={{ padding: 0 }}
            >
              <IconCheck filled={st.fait} size={16} />
            </button>
            <span
              className="tnv-meta-text"
              style={{ flex: 1, textDecoration: st.fait ? "line-through" : "none" }}
            >
              {st.titre}
            </span>
            <button className="tnv-icon-btn" onClick={() => supprimerSousTache(st.id)} title="Supprimer" aria-label="Supprimer">
              <IconTrash size={14} />
            </button>
          </div>
        ))}
        <form onSubmit={ajouterSousTache} style={{ display: "flex", gap: 6, marginTop: sousTaches.length ? 6 : 0 }}>
          <input
            className="tnv-input"
            style={{ minHeight: 32, padding: "6px 10px", fontSize: "var(--tnv-size-caption)", flex: 1 }}
            type="text"
            placeholder="+ Sous-tâche"
            value={nouvelleSousTache}
            onChange={(e) => setNouvelleSousTache(e.target.value)}
          />
          <button type="submit" className="tnv-btn tnv-btn--secondary" style={{ minHeight: 32, padding: "6px 14px" }}>
            Ajouter
          </button>
        </form>
      </div>

      <div>
        {jalons.map((j) => (
          <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <button
              className="tnv-icon-btn"
              onClick={() => basculerJalon(j)}
              title={j.fait ? "Marquer non fait" : "Marquer fait"}
              aria-label={j.fait ? "Marquer non fait" : "Marquer fait"}
              style={{ padding: 0 }}
            >
              <IconCheck filled={j.fait} size={16} />
            </button>
            <span className="tnv-meta-text" style={{ flex: 1, textDecoration: j.fait ? "line-through" : "none" }}>
              {j.titre} · {j.date}
            </span>
            <button className="tnv-icon-btn" onClick={() => supprimerJalon(j.id)} title="Supprimer" aria-label="Supprimer">
              <IconTrash size={14} />
            </button>
          </div>
        ))}
        <form onSubmit={ajouterJalon} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: jalons.length ? 6 : 0 }}>
          <input
            className="tnv-input"
            style={{ minHeight: 32, padding: "6px 10px", fontSize: "var(--tnv-size-caption)", flex: 1, minWidth: 120 }}
            type="text"
            placeholder="+ Jalon"
            value={nouveauJalonTitre}
            onChange={(e) => setNouveauJalonTitre(e.target.value)}
          />
          <input
            className="tnv-input"
            style={{ minHeight: 32, padding: "6px 10px", fontSize: "var(--tnv-size-caption)", width: 140 }}
            type="date"
            value={nouveauJalonDate}
            onChange={(e) => setNouveauJalonDate(e.target.value)}
          />
          <button type="submit" className="tnv-btn tnv-btn--secondary" style={{ minHeight: 32, padding: "6px 14px" }}>
            Ajouter
          </button>
        </form>
      </div>

      {historique.length > 0 && (
        <div>
          <p className="tnv-meta-text" style={{ fontWeight: 600, marginBottom: 4 }}>Historique de report</p>
          {historique.map((h) => (
            <p key={h.id} className="tnv-meta-text">
              {h.ancienne_echeance} → {h.nouvelle_echeance}
              {h.raison ? ` · ${h.raison}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskCard({ tache, raison, onEpingleToggle, onRecurrenteToggle, onRealiser, dense, children }) {
  const [pomodoroOuvert, setPomodoroOuvert] = useState(false);
  const [detailsOuverts, setDetailsOuverts] = useState(false);
  const badgeClass = raison === "anti_oubli" ? "tnv-badge tnv-badge--warning" : "tnv-badge tnv-badge--accent";
  const nbSousTaches = tache.sous_taches ? tache.sous_taches.length : 0;
  const nbJalons = tache.jalons ? tache.jalons.length : 0;
  const nbHistorique = tache.historique_reports ? tache.historique_reports.length : 0;

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

        {!dense && (
          <>
            <button
              onClick={() => setDetailsOuverts(!detailsOuverts)}
              style={{
                display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer",
                padding: 0, color: "var(--tnv-text-muted)", font: "inherit", fontSize: "var(--tnv-size-caption)", alignSelf: "flex-start",
              }}
            >
              <span style={{ display: "inline-flex", transform: detailsOuverts ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <IconChevronDown size={14} />
              </span>
              Détails
              {(nbSousTaches > 0 || nbJalons > 0 || nbHistorique > 0) &&
                ` (${nbSousTaches + nbJalons + nbHistorique})`}
            </button>
            {detailsOuverts && <DetailsTache tache={tache} />}
          </>
        )}
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
