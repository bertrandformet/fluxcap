import { useEffect, useState } from "react";
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

  useEffect(() => {
    api.definirGestionnaireSessionExpiree(() => setConnecte(false));
  }, []);

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
            title="Clés d'accès (Face ID/Touch ID)"
            aria-label="Clés d'accès"
          >
            <IconCle />
          </button>
          <button className="tnv-icon-btn" onClick={seDeconnecter} title="Se déconnecter" aria-label="Se déconnecter">
            <IconDeconnexion />
          </button>
        </div>
      </header>

      {panneauClesOuvert && <PanneauClesAcces onClose={() => setPanneauClesOuvert(false)} />}

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
        {ecran === "notes" && <Notes />}
        {ecran === "domaines" && <Domaines />}
        {ecran === "bord" && <TableauDeBord contexte={contexte} />}
      </main>

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
