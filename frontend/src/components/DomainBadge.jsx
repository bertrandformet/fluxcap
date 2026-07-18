import { domainHue } from "../utils/domainHue.js";

export default function DomainBadge({ domaine }) {
  if (!domaine) return null;
  const hue = domainHue(domaine.nom);
  return (
    <span className="tnv-badge tnv-badge--domain" style={{ "--domain-hue": hue }}>
      <span className="tnv-dot" style={{ "--domain-hue": hue }} />
      {domaine.nom}
    </span>
  );
}

export function DomainBadges({ domaines }) {
  if (!domaines || domaines.length === 0) return null;
  return (
    <>
      {domaines.map((d) => (
        <DomainBadge key={d.id} domaine={d} />
      ))}
    </>
  );
}
