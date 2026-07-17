import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  estWebauthnDisponible,
  optionsAuthentificationDepuisJson,
  optionsInscriptionDepuisJson,
  serialiserCredentialAuthentification,
  serialiserCredentialInscription,
} from "../utils/webauthn.js";

function CodeRecuperation({ code, onContinuer }) {
  return (
    <div className="tnv-form" style={{ width: "100%", maxWidth: 360 }}>
      <div>
        <p className="tnv-eyebrow">Important</p>
        <h1 className="tnv-h1" style={{ fontSize: 24 }}>
          Ton code de récupération
        </h1>
      </div>
      <p className="tnv-meta-text">
        Note ce code quelque part en sécurité (gestionnaire de mots de passe, papier...). Il te permettra de
        redéfinir un mot de passe si tu perds l'accès à ton mot de passe et à tes clés d'accès. Il ne sera plus
        jamais affiché — un nouveau sera généré si tu l'utilises.
      </p>
      <p
        className="tnv-h1"
        style={{ fontSize: 22, textAlign: "center", letterSpacing: 1, padding: "var(--tnv-space-4)", background: "var(--tnv-card-2)", borderRadius: "var(--tnv-radius-card)" }}
      >
        {code}
      </p>
      <button type="button" className="tnv-btn tnv-btn--primary" onClick={onContinuer}>
        J'ai noté ce code, continuer
      </button>
    </div>
  );
}

export default function Connexion({ onConnecte }) {
  const [statutConnu, setStatutConnu] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [webauthnDisponible, setWebauthnDisponible] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nomAppareil, setNomAppareil] = useState("");
  const [modeRecuperation, setModeRecuperation] = useState(false);
  const [codeRecup, setCodeRecup] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [codeAAfficher, setCodeAAfficher] = useState(null);

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

  function terminerConnexion(reponse) {
    api.definirJeton(reponse.jeton);
    if (reponse.code_recuperation) setCodeAAfficher(reponse.code_recuperation);
    else onConnecte();
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
      terminerConnexion(reponse);
    } catch (err) {
      setErreur(configure ? "Mot de passe incorrect." : err.message.replace(/^\d+ [^—]+— /, ""));
    } finally {
      setEnCours(false);
    }
  }

  async function soumettreRecuperation(e) {
    e.preventDefault();
    setErreur(null);
    if (nouveauMotDePasse.length < 8) {
      setErreur("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setEnCours(true);
    try {
      const reponse = await api.authRecuperer(codeRecup, nouveauMotDePasse);
      terminerConnexion(reponse);
    } catch (err) {
      setErreur("Code de récupération incorrect.");
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
      terminerConnexion(reponse);
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
      terminerConnexion(reponse);
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

  if (codeAAfficher) {
    return (
      <div className="tnv-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <CodeRecuperation code={codeAAfficher} onContinuer={onConnecte} />
      </div>
    );
  }

  const webauthnUtilisable = webauthnDisponible && estWebauthnDisponible();
  const proposerInscriptionCle = !configure && estWebauthnDisponible();

  if (configure && modeRecuperation) {
    return (
      <div className="tnv-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <form onSubmit={soumettreRecuperation} className="tnv-form" style={{ width: "100%", maxWidth: 360 }}>
          <div>
            <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 9, marginBottom: 8 }} />
            <p className="tnv-eyebrow">FluxCap</p>
            <h1 className="tnv-h1" style={{ fontSize: 24 }}>
              Récupération
            </h1>
          </div>
          <p className="tnv-meta-text">Entre le code de récupération noté au premier réglage, et choisis un nouveau mot de passe.</p>
          {erreur && <p className="tnv-error">{erreur}</p>}
          <input
            className="tnv-input"
            type="text"
            placeholder="Code de récupération"
            value={codeRecup}
            onChange={(e) => setCodeRecup(e.target.value)}
            autoFocus
          />
          <input
            className="tnv-input"
            type="password"
            placeholder="Nouveau mot de passe"
            value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
          />
          <button type="submit" className="tnv-btn tnv-btn--primary" disabled={enCours || !codeRecup || !nouveauMotDePasse}>
            {enCours ? "…" : "Réinitialiser le mot de passe"}
          </button>
          <button type="button" className="tnv-btn tnv-btn--ghost" onClick={() => { setModeRecuperation(false); setErreur(null); }}>
            Annuler
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="tnv-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="tnv-form" style={{ width: "100%", maxWidth: 360 }}>
        <div>
          <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 9, marginBottom: 8 }} />
          <p className="tnv-eyebrow">FluxCap</p>
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

        {configure && (
          <button type="button" className="tnv-btn tnv-btn--ghost" onClick={() => setModeRecuperation(true)}>
            Mot de passe oublié ?
          </button>
        )}

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
