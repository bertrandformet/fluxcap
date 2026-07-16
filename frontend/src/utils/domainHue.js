// Hash déterministe nom/id de domaine → teinte 0-360, pour --domain-hue.
export function domainHue(nameOrId) {
  const str = String(nameOrId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
