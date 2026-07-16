export default function ContextSwitch({ contexte, onChange, congesActif, onToggleConges }) {
  return (
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
      <button
        className={congesActif ? "tnv-segmented__option tnv-segmented__option--active" : "tnv-segmented__option"}
        onClick={onToggleConges}
        title={congesActif ? "Désactiver le mode congés" : "Activer le mode congés"}
      >
        Congés
      </button>
    </div>
  );
}
