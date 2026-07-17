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
        <span className="tnv-sheet__title">Clés d'accès (Face ID / Touch ID)</span>
        <p className="tnv-sheet__subtitle">Une clé par appareil — tu peux t'y connecter sans mot de passe depuis chacun.</p>

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
