import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  estWebauthnDisponible,
  optionsAuthentificationDepuisJson,
  optionsInscriptionDepuisJson,
  serialiserCredentialAuthentification,
  serialiserCredentialInscription,
} from "../utils/webauthn.js";

export default function Connexion({ onConnecte }) {
  const [statutConnu, setStatutConnu] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [webauthnDisponible, setWebauthnDisponible] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nomAppareil, setNomAppareil] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api
      .authStatut()
      .then((s) => {
        setConfigure(s.configure);
        setWebauthnDisponible(s.webauthn_disponible);
        setStatutConnu(true);
      })
      .catch((e) => setErreur(e.message));
  }, []);

  function messageErreur(err, repli) {
    if (err && err.name === "NotAllowedError") return "Annulé ou refusé par l'appareil.";
    return repli;
  }

  async function soumettreMotDePasse(e) {
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

  async function inscrireCle() {
    setErreur(null);
    setEnCours(true);
    const nom = nomAppareil.trim() || "Cet appareil";
    try {
      const options = await api.webauthnOptionsInscription(nom);
      const credential = await navigator.credentials.create({ publicKey: optionsInscriptionDepuisJson(options) });
      const reponse = await api.webauthnVerifierInscription(nom, serialiserCredentialInscription(credential));
      api.definirJeton(reponse.jeton);
      onConnecte();
    } catch (err) {
      setErreur(messageErreur(err, "Impossible d'enregistrer cette clé d'accès."));
    } finally {
      setEnCours(false);
    }
  }

  async function seConnecterAvecCle() {
    setErreur(null);
    setEnCours(true);
    try {
      const options = await api.webauthnOptionsAuthentification();
      const credential = await navigator.credentials.get({ publicKey: optionsAuthentificationDepuisJson(options) });
      const reponse = await api.webauthnVerifierAuthentification(serialiserCredentialAuthentification(credential));
      api.definirJeton(reponse.jeton);
      onConnecte();
    } catch (err) {
      setErreur(messageErreur(err, "Échec de la connexion par clé d'accès."));
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

  const webauthnUtilisable = webauthnDisponible && estWebauthnDisponible();
  const proposerInscriptionCle = !configure && estWebauthnDisponible();

  return (
    <div className="tnv-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="tnv-form" style={{ width: "100%", maxWidth: 360 }}>
        <div>
          <p className="tnv-eyebrow">Tâches, Notes &amp; Veille</p>
          <h1 className="tnv-h1" style={{ fontSize: 24 }}>
            {configure ? "Connexion" : "Premier réglage"}
          </h1>
        </div>
        {!configure && (
          <p className="tnv-meta-text">
            Aucun mode de connexion n'est encore configuré — choisis un mot de passe et/ou une clé d'accès
            (Face ID/Touch ID) pour protéger l'accès à l'app.
          </p>
        )}
        {erreur && <p className="tnv-error">{erreur}</p>}

        {webauthnUtilisable && (
          <button type="button" className="tnv-btn tnv-btn--primary" onClick={seConnecterAvecCle} disabled={enCours}>
            {enCours ? "…" : "Se connecter avec Face ID / Touch ID"}
          </button>
        )}

        {webauthnUtilisable && <p className="tnv-meta-text" style={{ textAlign: "center" }}>ou avec ton mot de passe</p>}

        <form onSubmit={soumettreMotDePasse} style={{ display: "flex", flexDirection: "column", gap: "var(--tnv-space-3)" }}>
          <input
            className="tnv-input"
            type="password"
            placeholder="Mot de passe"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoFocus={!webauthnUtilisable}
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
          <button type="submit" className="tnv-btn tnv-btn--secondary" disabled={enCours || !motDePasse}>
            {enCours ? "…" : configure ? "Se connecter avec le mot de passe" : "Définir le mot de passe"}
          </button>
        </form>

        {proposerInscriptionCle && (
          <>
            <p className="tnv-meta-text" style={{ textAlign: "center" }}>ou sans mot de passe</p>
            <input
              className="tnv-input"
              type="text"
              placeholder="Nom de cet appareil (ex. iPhone de Bertrand)"
              value={nomAppareil}
              onChange={(e) => setNomAppareil(e.target.value)}
            />
            <button type="button" className="tnv-btn tnv-btn--outline" onClick={inscrireCle} disabled={enCours}>
              {enCours ? "…" : "Enregistrer une clé d'accès (Face ID/Touch ID)"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
