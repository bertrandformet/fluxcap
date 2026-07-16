import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Connexion({ onConnecte }) {
  const [statutConnu, setStatutConnu] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api
      .authStatut()
      .then((s) => {
        setConfigure(s.configure);
        setStatutConnu(true);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    if (!configure && motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnCours(true);
    try {
      const reponse = configure ? await api.authConnexion(motDePasse) : await api.authConfigurerMotDePasse(motDePasse);
      api.definirJeton(reponse.jeton);
      onConnecte();
    } catch (err) {
      setErreur(configure ? "Mot de passe incorrect." : err.message.replace(/^\d+ [^—]+— /, ""));
    } finally {
      setEnCours(false);
    }
  }

  if (!statutConnu) {
    return (
      <div className="tnv-screen">
        <p className="tnv-empty">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="tnv-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <form className="tnv-form" style={{ width: "100%", maxWidth: 360 }} onSubmit={soumettre}>
        <div>
          <p className="tnv-eyebrow">Tâches, Notes &amp; Veille</p>
          <h1 className="tnv-h1" style={{ fontSize: 24 }}>
            {configure ? "Connexion" : "Premier réglage"}
          </h1>
        </div>
        {!configure && (
          <p className="tnv-meta-text">
            Aucun mode de connexion n'est encore configuré — choisis un mot de passe pour protéger l'accès à l'app.
          </p>
        )}
        {erreur && <p className="tnv-error">{erreur}</p>}
        <input
          className="tnv-input"
          type="password"
          placeholder="Mot de passe"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          autoFocus
        />
        {!configure && (
          <input
            className="tnv-input"
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        )}
        <button type="submit" className="tnv-btn tnv-btn--primary" disabled={enCours || !motDePasse}>
          {enCours ? "…" : configure ? "Se connecter" : "Définir le mot de passe"}
        </button>
      </form>
    </div>
  );
}
