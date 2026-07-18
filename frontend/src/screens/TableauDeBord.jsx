import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const PRIORITES = [
  { value: "aujourd_hui", label: "Aujourd'hui" },
  { value: "cette_semaine", label: "Cette semaine" },
  { value: "un_jour", label: "Un jour" },
];

function Repartition({ lignes }) {
  const total = Math.max(1, lignes.reduce((somme, l) => somme + l.count, 0));
  return (
    <div className="tnv-stack" style={{ marginBottom: 0 }}>
      {lignes.map((l) => (
        <div key={l.label} className="tnv-bar-row">
          <div className="tnv-bar-row__labels">
            <span style={{ color: "var(--tnv-text)", fontWeight: 600 }}>{l.label}</span>
            <span style={{ color: "var(--tnv-text-muted)" }}>
              {l.count} / {total}
            </span>
          </div>
          <div className="tnv-bar-track">
            <div className="tnv-bar-fill" style={{ width: `${(l.count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TableauDeBord({ contexte }) {
  const [taches, setTaches] = useState(null);
  const [domaines, setDomaines] = useState([]);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    setTaches(null);
    Promise.all([api.getTaches(contexte), api.getDomaines(contexte, "taches")])
      .then(([t, d]) => {
        setTaches(t.filter((tache) => tache.statut === "a_realiser"));
        setDomaines(d);
      })
      .catch((e) => setErreur(e.message));
  }, [contexte]);

  if (erreur) return <p className="tnv-error">{erreur}</p>;
  if (!taches) return <p className="tnv-empty">Chargement…</p>;

  const parDomaine = domaines.map((d) => ({
    label: d.nom,
    count: taches.filter((t) => t.domaine_id === d.id).length,
  }));

  const parPriorite = PRIORITES.map((p) => ({
    label: p.label,
    count: taches.filter((t) => t.priorite === p.value).length,
  }));

  return (
    <div className="tnv-screen">
      <p className="tnv-eyebrow">{contexte === "pro" ? "Espace professionnel" : "Espace personnel"}</p>
      <h1 className="tnv-h1">Tableau de bord</h1>
      <p className="tnv-meta-text" style={{ marginBottom: "var(--tnv-space-5)" }}>
        {taches.length} tâche(s) active(s) — état à l'instant présent, aucun historique
      </p>

      <div className="tnv-card" style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
        <span className="tnv-section-label">Par domaine</span>
        {parDomaine.length === 0 ? <p className="tnv-empty">Aucun domaine.</p> : <Repartition lignes={parDomaine} />}
      </div>

      <div className="tnv-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="tnv-section-label">Par priorité</span>
        <Repartition lignes={parPriorite} />
      </div>
    </div>
  );
}
