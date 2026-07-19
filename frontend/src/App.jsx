import { useEffect, useRef, useState } from "react";
import { api } from "./api/client.js";
import ContextSwitch from "./components/ContextSwitch.jsx";
import { IconCle, IconDeconnexion, IconMoon, IconSun } from "./components/Icons.jsx";
import PanneauClesAcces from "./components/PanneauClesAcces.jsx";
import Aujourdhui from "./screens/Aujourdhui.jsx";
import Cloture from "./screens/Cloture.jsx";
import Connexion from "./screens/Connexion.jsx";
import Veille from "./screens/Veille.jsx";
import Notes from "./screens/Notes.jsx";
import Domaines from "./screens/Domaines.jsx";
import TableauDeBord from "./screens/TableauDeBord.jsx";

const ECRANS = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "cloture", label: "Clôture" },
  { id: "notes", label: "Notes" },
  { id: "veille", label: "Veille" },
  { id: "domaines", label: "Domaines" },
  { id: "bord", label: "Tableau de bord" },
];

function themeSysteme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [contexte, setContexte] = useState(() => localStorage.getItem("contexte") || "pro");
  const [ecran, setEcran] = useState("aujourdhui");
  const [congesActif, setCongesActif] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || null);
  const [connecte, setConnecte] = useState(() => api.estConnecte());
  const [panneauClesOuvert, setPanneauClesOuvert] = useState(false);
  const [capture] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("capture_url");
    const titre = params.get("capture_titre");
    return url || titre ? { url, titre } : null;
  });
  const [captureStatut, setCaptureStatut] = useState(null);
  const captureLancee = useRef(false);

  useEffect(() => {
    api.definirGestionnaireSessionExpiree(() => setConnecte(false));
  }, []);

  useEffect(() => {
    // Attend une confirmation explicite avant de rien créer : ouvrir cette URL avec
    // une session active ne doit pas suffire à créer une note (un lien piégé le
    // pourrait sinon sans qu'on l'ait demandé).
    if (!connecte || !capture || captureStatut) return;
    setCaptureStatut("attente");
  }, [connecte, capture, captureStatut]);

  function fermerCapture() {
    if (window.opener) window.close();
    else window.location.assign(window.location.pathname);
  }

  async function confirmerCapture() {
    if (captureLancee.current) return;
    captureLancee.current = true;
    setCaptureStatut("en-cours");
    let titre = capture.titre || capture.url;
    let apercu;
    if (capture.url) {
      try {
        const infos = await api.apercuLien(capture.url);
        if (infos.titre) titre = infos.titre;
        if (infos.apercu) apercu = infos.apercu;
      } catch {
        // tant pis, on garde le titre du navigateur et pas d'aperçu
      }
    }
    try {
      await api.creerNote({ titre, url: capture.url || undefined, apercu });
      setCaptureStatut("ok");
    } catch {
      setCaptureStatut("erreur");
    } finally {
      setTimeout(fermerCapture, 1200);
    }
  }

  useEffect(() => {
    if (!connecte) return;
    api.getParametres().then((p) => setCongesActif(p.conges_actif));
  }, [connecte]);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  function seDeconnecter() {
    api.definirJeton(null);
    setConnecte(false);
  }

  function basculerTheme() {
    const effectif = theme || themeSysteme();
    const suivant = effectif === "dark" ? "light" : "dark";
    setTheme(suivant);
    localStorage.setItem("theme", suivant);
  }

  function changerContexte(valeur) {
    setContexte(valeur);
    localStorage.setItem("contexte", valeur);
  }

  async function basculerConges() {
    const nouveauteEtat = !congesActif;
    await api.modifierParametres({ conges_actif: nouveauteEtat });
    setCongesActif(nouveauteEtat);
  }

  const themeEffectif = theme || themeSysteme();

  if (!connecte) {
    return (
      <div className="tnv-app-shell">
        <Connexion onConnecte={() => setConnecte(true)} />
      </div>
    );
  }

  if (capture) {
    return (
      <div
        className="tnv-app-shell"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center" }}
      >
        <div>
          <img src="/icon-192.png" alt="" width={48} height={48} style={{ borderRadius: 10, marginBottom: 12 }} />
          {captureStatut === "attente" && (
            <>
              <p className="tnv-h1" style={{ fontSize: 17 }}>Ajouter cette page à FluxCap ?</p>
              <p className="tnv-meta-text" style={{ margin: "8px 0 16px", wordBreak: "break-all" }}>
                {capture.titre || capture.url}
                {capture.url && capture.titre ? <br /> : null}
                {capture.url}
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="tnv-btn tnv-btn--ghost" onClick={fermerCapture}>Annuler</button>
                <button className="tnv-btn tnv-btn--primary" onClick={confirmerCapture}>Ajouter à FluxCap</button>
              </div>
            </>
          )}
          {captureStatut === "en-cours" && <p className="tnv-h1" style={{ fontSize: 17 }}>Capture en cours…</p>}
          {captureStatut === "ok" && <p className="tnv-h1" style={{ fontSize: 17 }}>Note ajoutée à FluxCap ✅</p>}
          {captureStatut === "erreur" && <p className="tnv-h1" style={{ fontSize: 17 }}>Échec de la capture</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="tnv-app-shell">
      <header className="tnv-header">
        <span className="tnv-header__brand" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <img src="/icon-192.png" alt="" width={24} height={24} style={{ borderRadius: 6 }} />
          FluxCap
        </span>
        <div className="tnv-header__actions">
          <ContextSwitch contexte={contexte} onChange={changerContexte} congesActif={congesActif} onToggleConges={basculerConges} />
          <button
            className="tnv-icon-btn"
            onClick={basculerTheme}
            title={themeEffectif === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            aria-label="Changer de thème"
          >
            {themeEffectif === "dark" ? <IconMoon /> : <IconSun />}
          </button>
          <button
            className="tnv-icon-btn"
            onClick={() => setPanneauClesOuvert(true)}
            title="Sécurité (mot de passe, clés d'accès, sessions)"
            aria-label="Sécurité"
          >
            <IconCle />
          </button>
          <button className="tnv-icon-btn" onClick={seDeconnecter} title="Se déconnecter" aria-label="Se déconnecter">
            <IconDeconnexion />
          </button>
        </div>
      </header>

      {panneauClesOuvert && (
        <PanneauClesAcces onClose={() => setPanneauClesOuvert(false)} onDeconnecte={seDeconnecter} />
      )}

      <nav className="tnv-nav">
        {ECRANS.map((e) => (
          <button
            key={e.id}
            className={e.id === ecran ? "tnv-nav__item tnv-nav__item--active" : "tnv-nav__item"}
            onClick={() => setEcran(e.id)}
          >
            {e.label}
          </button>
        ))}
      </nav>

      <main>
        {ecran === "aujourdhui" && (
          <Aujourdhui contexte={contexte} congesActif={congesActif} onNaviguerVeille={() => setEcran("veille")} />
        )}
        {ecran === "cloture" && <Cloture contexte={contexte} />}
        {ecran === "veille" && <Veille contexte={contexte} />}
        {ecran === "notes" && <Notes contexte={contexte} />}
        {ecran === "domaines" && <Domaines />}
        {ecran === "bord" && <TableauDeBord contexte={contexte} />}
      </main>

      <footer className="tnv-footer">
        <span>FluxCap © Bertrand Formet</span>
        <span aria-hidden="true">·</span>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/bertrandformet/fluxcap" target="_blank" rel="noreferrer">GitHub</a>
      </footer>

      <nav className="tnv-tabbar">
        {ECRANS.map((e) => (
          <button
            key={e.id}
            className={e.id === ecran ? "tnv-tabbar__item tnv-tabbar__item--active" : "tnv-tabbar__item"}
            onClick={() => setEcran(e.id)}
          >
            <span className="tnv-tabbar__dot" />
            <span className="tnv-tabbar__label">{e.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
