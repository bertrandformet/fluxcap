import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Domaines() {
  const [domaines, setDomaines] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enEdition, setEnEdition] = useState(null); // id du domaine en cours d'édition
  const [nomEdition, setNomEdition] = useState("");

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauContexte, setNouveauContexte] = useState("pro");

  useEffect(() => {
    charger();
  }, []);

  function charger() {
    setErreur(null);
    api.getDomaines().then(setDomaines).catch((e) => setErreur(e.message));
  }

  async function ajouterDomaine(e) {
    e.preventDefault();
    if (!nouveauNom.trim()) return;
    try {
      await api.creerDomaine({ nom: nouveauNom.trim(), contexte: nouveauContexte });
      setNouveauNom("");
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function commencerEdition(domaine) {
    setEnEdition(domaine.id);
    setNomEdition(domaine.nom);
  }

  async function enregistrerEdition(domaine) {
    try {
      await api.modifierDomaine(domaine.id, { nom: nomEdition });
      setEnEdition(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function changerContexte(domaine, contexte) {
    try {
      await api.modifierDomaine(domaine.id, { contexte });
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(domaine) {
    try {
      await api.supprimerDomaine(domaine.id);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (!domaines) return <p>Chargement…</p>;

  const parContexte = {
    pro: domaines.filter((d) => d.contexte === "pro"),
    perso: domaines.filter((d) => d.contexte === "perso"),
  };

  return (
    <section>
      <h2>Domaines &amp; tags</h2>
      <p className="explication">
        Ces domaines servent à la fois à classer les tâches et la veille par contexte, et de tags pour
        filtrer les notes. Renommez-les, changez leur contexte ou ajoutez-en de nouveaux.
      </p>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="import-lien" onSubmit={ajouterDomaine}>
        <input
          type="text"
          placeholder="Nom du domaine"
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
        />
        <select value={nouveauContexte} onChange={(e) => setNouveauContexte(e.target.value)}>
          <option value="pro">Pro</option>
          <option value="perso">Perso</option>
        </select>
        <button type="submit">+ Domaine</button>
      </form>

      {["pro", "perso"].map((contexte) => (
        <div key={contexte} className="domaine-groupe">
          <h3>{contexte === "pro" ? "Pro" : "Perso"}</h3>
          {parContexte[contexte].length === 0 && <p>Aucun domaine.</p>}
          <ul className="domaine-list">
            {parContexte[contexte].map((d) => (
              <li key={d.id} className="domaine-item">
                {enEdition === d.id ? (
                  <>
                    <input value={nomEdition} onChange={(e) => setNomEdition(e.target.value)} />
                    <button className="bouton-icone" onClick={() => enregistrerEdition(d)} title="Enregistrer" aria-label="Enregistrer">
                      ✓
                    </button>
                    <button className="bouton-icone" onClick={() => setEnEdition(null)} title="Annuler" aria-label="Annuler">
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span>{d.nom}</span>
                    <select value={d.contexte} onChange={(e) => changerContexte(d, e.target.value)}>
                      <option value="pro">Pro</option>
                      <option value="perso">Perso</option>
                    </select>
                    <button className="bouton-icone" onClick={() => commencerEdition(d)} title="Renommer" aria-label="Renommer">
                      ✏️
                    </button>
                    <button className="bouton-icone" onClick={() => supprimer(d)} title="Supprimer" aria-label="Supprimer">
                      🗑
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
