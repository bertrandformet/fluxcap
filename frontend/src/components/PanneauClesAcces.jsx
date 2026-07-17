import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { IconTrash } from "./Icons.jsx";
import { estWebauthnDisponible, optionsInscriptionDepuisJson, serialiserCredentialInscription } from "../utils/webauthn.js";

export default function PanneauClesAcces({ onClose, onDeconnecte }) {
  const [identifiants, setIdentifiants] = useState(null);
  const [nomAppareil, setNomAppareil] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [enCoursDeconnexion, setEnCoursDeconnexion] = useState(false);
  const [codeRecuperation, setCodeRecuperation] = useState(null);
  const [enCoursCode, setEnCoursCode] = useState(false);
  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [messageMotDePasse, setMessageMotDePasse] = useState(null);
  const [enCoursMotDePasse, setEnCoursMotDePasse] = useState(false);

  useEffect(() => {
    charger();
  }, []);

  function charger() {
    api.webauthnListerIdentifiants().then(setIdentifiants).catch((e) => setErreur(e.message));
  }

  async function ajouterCle(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    const nom = nomAppareil.trim() || "Cet appareil";
    try {
      const options = await api.webauthnOptionsInscription(nom);
      const credential = await navigator.credentials.create({ publicKey: optionsInscriptionDepuisJson(options) });
      await api.webauthnVerifierInscription(nom, serialiserCredentialInscription(credential));
      setNomAppareil("");
      charger();
    } catch (err) {
      setErreur(err.name === "NotAllowedError" ? "Annulé ou refusé par l'appareil." : "Impossible d'enregistrer cette clé.");
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(id) {
    if (!window.confirm("Supprimer cette clé d'accès ?")) return;
    try {
      await api.webauthnSupprimerIdentifiant(id);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function changerMotDePasse(e) {
    e.preventDefault();
    setMessageMotDePasse(null);
    if (nouveauMotDePasse.length < 8) {
      setMessageMotDePasse({ type: "erreur", texte: "Le nouveau mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setMessageMotDePasse({ type: "erreur", texte: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setEnCoursMotDePasse(true);
    try {
      const reponse = await api.authChangerMotDePasse(motDePasseActuel || undefined, nouveauMotDePasse);
      api.definirJeton(reponse.jeton);
      setMotDePasseActuel("");
      setNouveauMotDePasse("");
      setConfirmationMotDePasse("");
      setMessageMotDePasse({ type: "succes", texte: "Mot de passe mis à jour. Les autres sessions ont été déconnectées." });
    } catch (err) {
      setMessageMotDePasse({
        type: "erreur",
        texte: err.message.includes("401") ? "Mot de passe actuel incorrect." : err.message.replace(/^\d+ [^—]+— /, ""),
      });
    } finally {
      setEnCoursMotDePasse(false);
    }
  }

  async function regenererCode() {
    if (!window.confirm("Générer un nouveau code de récupération ? L'ancien ne fonctionnera plus.")) return;
    setEnCoursCode(true);
    setErreur(null);
    try {
      const reponse = await api.authRegenererCodeRecuperation();
      setCodeRecuperation(reponse.code_recuperation);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCoursCode(false);
    }
  }

  async function deconnecterPartout() {
    if (!window.confirm("Déconnecter tous les appareils ? Il faudra se reconnecter partout, y compris ici.")) return;
    setEnCoursDeconnexion(true);
    try {
      await api.authDeconnecterPartout();
      onDeconnecte();
    } catch (err) {
      setErreur(err.message);
      setEnCoursDeconnexion(false);
    }
  }

  return (
    <div className="tnv-overlay tnv-sheet" onClick={onClose}>
      <div className="tnv-sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="tnv-sheet__grabber" />
        <span className="tnv-sheet__title">Sécurité</span>

        <div>
          <p className="tnv-task-card__title" style={{ marginBottom: 4 }}>Mot de passe</p>
          <form onSubmit={changerMotDePasse} style={{ display: "flex", flexDirection: "column", gap: "var(--tnv-space-3)" }}>
            <input
              className="tnv-input"
              type="password"
              placeholder="Mot de passe actuel (laisser vide si aucun)"
              value={motDePasseActuel}
              onChange={(e) => setMotDePasseActuel(e.target.value)}
            />
            <input
              className="tnv-input"
              type="password"
              placeholder="Nouveau mot de passe"
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
            />
            <input
              className="tnv-input"
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmationMotDePasse}
              onChange={(e) => setConfirmationMotDePasse(e.target.value)}
            />
            {messageMotDePasse && (
              <p className={messageMotDePasse.type === "erreur" ? "tnv-error" : "tnv-meta-text"}>
                {messageMotDePasse.texte}
              </p>
            )}
            <button type="submit" className="tnv-btn tnv-btn--secondary" disabled={enCoursMotDePasse || !nouveauMotDePasse}>
              {enCoursMotDePasse ? "…" : "Mettre à jour le mot de passe"}
            </button>
          </form>
        </div>

        <div style={{ borderTop: "1px solid var(--tnv-hairline)", paddingTop: "var(--tnv-space-3)" }}>
          <p className="tnv-task-card__title" style={{ marginBottom: 4 }}>Clés d'accès (Face ID / Touch ID)</p>
          <p className="tnv-sheet__subtitle">Une clé par appareil — tu peux t'y connecter sans mot de passe depuis chacun.</p>
        </div>

        {erreur && <p className="tnv-error">{erreur}</p>}
        {!identifiants && <p className="tnv-empty">Chargement…</p>}
        {identifiants && identifiants.length === 0 && <p className="tnv-empty">Aucune clé enregistrée.</p>}

        {identifiants && identifiants.length > 0 && (
          <div className="tnv-stack" style={{ marginBottom: 0 }}>
            {identifiants.map((id) => (
              <div
                key={id.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--tnv-hairline)" }}
              >
                <span style={{ flex: 1 }} className="tnv-task-card__title">
                  {id.nom}
                </span>
                <button className="tnv-icon-btn" onClick={() => supprimer(id.id)} title="Supprimer" aria-label="Supprimer">
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {estWebauthnDisponible() ? (
          <form onSubmit={ajouterCle} style={{ display: "flex", flexDirection: "column", gap: "var(--tnv-space-3)" }}>
            <input
              className="tnv-input"
              type="text"
              placeholder="Nom de cet appareil (ex. iPhone)"
              value={nomAppareil}
              onChange={(e) => setNomAppareil(e.target.value)}
            />
            <button type="submit" className="tnv-btn tnv-btn--primary" disabled={enCours}>
              {enCours ? "…" : "+ Ajouter cet appareil"}
            </button>
          </form>
        ) : (
          <p className="tnv-meta-text">Ce navigateur ne supporte pas les clés d'accès.</p>
        )}

        <div style={{ borderTop: "1px solid var(--tnv-hairline)", paddingTop: "var(--tnv-space-3)" }}>
          <p className="tnv-task-card__title" style={{ marginBottom: 4 }}>Code de récupération</p>
          <p className="tnv-meta-text" style={{ marginBottom: 8 }}>
            Utilisé pour redéfinir ton mot de passe si tu perds l'accès. Le régénérer ici invalide l'ancien —
            affiché une seule fois, à noter aussitôt.
          </p>
          {codeRecuperation && (
            <p
              className="tnv-h1"
              style={{
                fontSize: 18,
                textAlign: "center",
                letterSpacing: 1,
                padding: "var(--tnv-space-3)",
                background: "var(--tnv-card-2)",
                borderRadius: "var(--tnv-radius-card)",
                marginBottom: 8,
              }}
            >
              {codeRecuperation}
            </p>
          )}
          <button className="tnv-btn tnv-btn--outline" onClick={regenererCode} disabled={enCoursCode}>
            {enCoursCode ? "…" : codeRecuperation ? "Générer un autre code" : "Générer un nouveau code"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--tnv-hairline)", paddingTop: "var(--tnv-space-3)" }}>
          <p className="tnv-task-card__title" style={{ marginBottom: 4 }}>Sessions</p>
          <p className="tnv-meta-text" style={{ marginBottom: 8 }}>
            Un jeton de connexion aurait fuité (appareil perdu, session oubliée sur un poste partagé...) ? Invalide
            toutes les sessions ouvertes — il faudra se reconnecter partout, y compris ici.
          </p>
          <button className="tnv-btn tnv-btn--outline" onClick={deconnecterPartout} disabled={enCoursDeconnexion}>
            {enCoursDeconnexion ? "…" : "Déconnecter tous les appareils"}
          </button>
        </div>

        <button className="tnv-btn tnv-btn--ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
