import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { IconEdit } from "../components/Icons.jsx";
import { domainHue } from "../utils/domainHue.js";

const LABELS_CONTEXTE = { pro: "Pro", perso: "Perso", les_deux: "Les deux" };

export default function Domaines() {
  const [domaines, setDomaines] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enEdition, setEnEdition] = useState(null); // id du domaine en cours d'édition
  const [nomEdition, setNomEdition] = useState("");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauContexte, setNouveauContexte] = useState("pro");
  const [nouveauUtiliseTaches, setNouveauUtiliseTaches] = useState(true);
  const [nouveauUtiliseVeille, setNouveauUtiliseVeille] = useState(true);

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
      await api.creerDomaine({
        nom: nouveauNom.trim(),
        contexte: nouveauContexte,
        utilise_pour_taches: nouveauUtiliseTaches,
        utilise_pour_veille: nouveauUtiliseVeille,
      });
      setNouveauNom("");
      setNouveauUtiliseTaches(true);
      setNouveauUtiliseVeille(true);
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function basculerUsage(domaine, champ) {
    try {
      await api.modifierDomaine(domaine.id, { [champ]: !domaine[champ] });
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
    if (!window.confirm(`Supprimer le domaine « ${domaine.nom} » ?`)) return;
    try {
      await api.supprimerDomaine(domaine.id);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  if (!domaines) return <p className="tnv-empty">Chargement…</p>;

  return (
    <div className="tnv-screen">
      <div className="tnv-screen-head">
        <div>
          <p className="tnv-eyebrow">Classement des tâches, veille &amp; notes</p>
          <h1 className="tnv-h1">Domaines</h1>
        </div>
      </div>
      <p className="tnv-meta-text" style={{ marginBottom: "var(--tnv-space-5)" }}>
        Ces domaines servent à classer les tâches et la veille par contexte, et de tags pour filtrer les notes.
        Utilise les badges "Tâches"/"Veille" pour retirer un domaine des sélecteurs où il n'a pas sa place
        (ex. un sujet de veille large n'est pas une catégorie de tâche actionnable).
      </p>

      {erreur && <p className="tnv-error">{erreur}</p>}

      {["pro", "perso", "les_deux"].map((contexte) => {
        const groupe = domaines.filter((d) => d.contexte === contexte);
        return (
          <div key={contexte} style={{ marginBottom: "var(--tnv-space-5)" }}>
            <span className="tnv-section-label">{LABELS_CONTEXTE[contexte]}</span>
            <div className="tnv-stack" style={{ marginTop: 10, marginBottom: 0 }}>
              {groupe.length === 0 && <p className="tnv-empty">Aucun domaine.</p>}
              {groupe.map((d) => (
                <div key={d.id} className="tnv-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="tnv-dot" style={{ "--domain-hue": domainHue(d.nom), width: 10, height: 10 }} />
                  {enEdition === d.id ? (
                    <>
                      <input
                        className="tnv-input"
                        style={{ flex: 1, minHeight: 36, padding: "6px 10px" }}
                        value={nomEdition}
                        onChange={(e) => setNomEdition(e.target.value)}
                      />
                      <button className="tnv-btn tnv-btn--primary" onClick={() => enregistrerEdition(d)}>
                        Enregistrer
                      </button>
                      <button className="tnv-btn tnv-btn--ghost" onClick={() => setEnEdition(null)}>
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tnv-task-card__title" style={{ flex: 1, minWidth: 0 }}>
                        {d.nom}
                      </span>
                      <select
                        className="tnv-select"
                        style={{ width: "auto", minHeight: 36, padding: "6px 10px" }}
                        value={d.contexte}
                        onChange={(e) => changerContexte(d, e.target.value)}
                      >
                        <option value="pro">Pro</option>
                        <option value="perso">Perso</option>
                        <option value="les_deux">Les deux</option>
                      </select>
                      <button
                        type="button"
                        className={d.utilise_pour_taches ? "tnv-badge tnv-badge--accent" : "tnv-badge tnv-badge--muted"}
                        style={{ border: "none", cursor: "pointer", font: "inherit" }}
                        onClick={() => basculerUsage(d, "utilise_pour_taches")}
                        title={d.utilise_pour_taches ? "Utilisé pour les tâches — cliquer pour retirer" : "Non utilisé pour les tâches — cliquer pour ajouter"}
                      >
                        Tâches
                      </button>
                      <button
                        type="button"
                        className={d.utilise_pour_veille ? "tnv-badge tnv-badge--accent" : "tnv-badge tnv-badge--muted"}
                        style={{ border: "none", cursor: "pointer", font: "inherit" }}
                        onClick={() => basculerUsage(d, "utilise_pour_veille")}
                        title={d.utilise_pour_veille ? "Utilisé pour la veille — cliquer pour retirer" : "Non utilisé pour la veille — cliquer pour ajouter"}
                      >
                        Veille
                      </button>
                      <button className="tnv-icon-btn" onClick={() => commencerEdition(d)} title="Renommer" aria-label="Renommer">
                        <IconEdit size={16} />
                      </button>
                      <button className="tnv-btn tnv-btn--danger-ghost" onClick={() => supprimer(d)}>
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {formulaireOuvert ? (
        <form className="tnv-form" onSubmit={ajouterDomaine}>
          <input
            className="tnv-input"
            type="text"
            placeholder="Nom du domaine"
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
          />
          <select className="tnv-select" value={nouveauContexte} onChange={(e) => setNouveauContexte(e.target.value)}>
            <option value="pro">Pro</option>
            <option value="perso">Perso</option>
            <option value="les_deux">Les deux</option>
          </select>
          <label className="tnv-checkbox-row">
            <input type="checkbox" checked={nouveauUtiliseTaches} onChange={(e) => setNouveauUtiliseTaches(e.target.checked)} />
            Utilisable pour les tâches
          </label>
          <label className="tnv-checkbox-row">
            <input type="checkbox" checked={nouveauUtiliseVeille} onChange={(e) => setNouveauUtiliseVeille(e.target.checked)} />
            Utilisable pour la veille
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="tnv-btn tnv-btn--primary">
              Ajouter le domaine
            </button>
            <button type="button" className="tnv-btn tnv-btn--ghost" onClick={() => setFormulaireOuvert(false)}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          className="tnv-btn"
          style={{
            border: "1.5px dashed var(--tnv-hairline)",
            background: "none",
            color: "var(--tnv-accent)",
            borderRadius: "var(--tnv-radius-card)",
            width: "100%",
            marginTop: "var(--tnv-space-3)",
          }}
          onClick={() => setFormulaireOuvert(true)}
        >
          + Ajouter un domaine
        </button>
      )}
    </div>
  );
}
