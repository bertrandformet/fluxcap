import Switch from "./Switch.jsx";

export default function ContextSwitch({ contexte, onChange, congesActif, onToggleConges }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="tnv-segmented">
        <button
          className={contexte === "pro" ? "tnv-segmented__option tnv-segmented__option--active" : "tnv-segmented__option"}
          onClick={() => onChange("pro")}
          title={congesActif ? "Pro en pause pendant les congés" : undefined}
        >
          Pro
        </button>
        <button
          className={contexte === "perso" ? "tnv-segmented__option tnv-segmented__option--active" : "tnv-segmented__option"}
          onClick={() => onChange("perso")}
        >
          Perso
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="tnv-meta-text">Congés</span>
        <Switch
          checked={congesActif}
          onChange={onToggleConges}
          label={congesActif ? "Désactiver le mode congés" : "Activer le mode congés"}
        />
      </div>
    </div>
  );
}
