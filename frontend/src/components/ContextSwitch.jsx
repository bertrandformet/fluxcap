export default function ContextSwitch({ contexte, onChange, congesActif }) {
  return (
    <div className="context-switch">
      <button className={contexte === "pro" ? "active" : ""} onClick={() => onChange("pro")}>
        Pro{congesActif && <span title="En pause pendant les congés"> ⏸</span>}
      </button>
      <button className={contexte === "perso" ? "active" : ""} onClick={() => onChange("perso")}>
        Perso
      </button>
    </div>
  );
}
