export default function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={checked ? "tnv-switch tnv-switch--on" : "tnv-switch"}
      onClick={() => onChange(!checked)}
    >
      <span className="tnv-switch__knob" />
    </button>
  );
}
