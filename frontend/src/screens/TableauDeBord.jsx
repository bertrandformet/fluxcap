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
    <div className="repartition">
      {lignes.map((l) => (
        <div key={l.label} className="repartition-ligne">
          <span className="repartition-label">{l.label}</span>
          <div className="repartition-barre">
            <div className="repartition-remplissage" style={{ width: `${(l.count / total) * 100}%` }} />
          </div>
          <span className="repartition-valeur">
            {l.count} / {total}
          </span>
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
    Promise.all([api.getTaches(contexte), api.getDomaines(contexte)])
      .then(([t, d]) => {
        setTaches(t.filter((tache) => tache.statut === "a_realiser"));
        setDomaines(d);
      })
      .catch((e) => setErreur(e.message));
  }, [contexte]);

  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!taches) return <p>Chargement…</p>;

  const parDomaine = domaines.map((d) => ({
    label: d.nom,
    count: taches.filter((t) => t.domaine_id === d.id).length,
  }));

  const parPriorite = PRIORITES.map((p) => ({
    label: p.label,
    count: taches.filter((t) => t.priorite === p.value).length,
  }));

  return (
    <section>
      <h2>Tableau de bord</h2>
      <p className="compteur">{taches.length} tâche(s) active(s) — état à l'instant présent, aucun historique</p>

      <h3>Par domaine</h3>
      {parDomaine.length === 0 ? <p>Aucun domaine.</p> : <Repartition lignes={parDomaine} />}

      <h3>Par priorité</h3>
      <Repartition lignes={parPriorite} />
    </section>
  );
}
