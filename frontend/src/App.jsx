import { useEffect, useState } from "react";
import { api } from "./api/client.js";
import ContextSwitch from "./components/ContextSwitch.jsx";
import Aujourdhui from "./screens/Aujourdhui.jsx";
import Cloture from "./screens/Cloture.jsx";
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

export default function App() {
  const [contexte, setContexte] = useState(() => localStorage.getItem("contexte") || "pro");
  const [ecran, setEcran] = useState("aujourdhui");
  const [congesActif, setCongesActif] = useState(false);

  useEffect(() => {
    api.getParametres().then((p) => setCongesActif(p.conges_actif));
  }, []);

  function changerContexte(valeur) {
    setContexte(valeur);
    localStorage.setItem("contexte", valeur);
  }

  async function basculerConges() {
    const nouveauteEtat = !congesActif;
    await api.modifierParametres({ conges_actif: nouveauteEtat });
    setCongesActif(nouveauteEtat);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tâches, Notes &amp; Veille</h1>
        <div className="groupe-contexte">
          <ContextSwitch contexte={contexte} onChange={changerContexte} congesActif={congesActif} />
          <button
            className={congesActif ? "bouton-conges actif" : "bouton-conges"}
            onClick={basculerConges}
            title={congesActif ? "Fin des congés" : "Je suis en congés"}
          >
            🏖️ Congés
          </button>
        </div>
      </header>

      <nav className="tabs">
        {ECRANS.map((e) => (
          <button
            key={e.id}
            className={e.id === ecran ? "tab active" : "tab"}
            onClick={() => setEcran(e.id)}
          >
            {e.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {ecran === "aujourdhui" && (
          <Aujourdhui contexte={contexte} congesActif={congesActif} onNaviguerVeille={() => setEcran("veille")} />
        )}
        {ecran === "cloture" && <Cloture contexte={contexte} />}
        {ecran === "veille" && <Veille contexte={contexte} />}
        {ecran === "notes" && <Notes />}
        {ecran === "domaines" && <Domaines />}
        {ecran === "bord" && <TableauDeBord contexte={contexte} />}
      </main>
    </div>
  );
}
