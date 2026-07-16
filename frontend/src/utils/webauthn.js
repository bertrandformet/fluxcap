// Sérialisation manuelle des credentials WebAuthn en JSON (plutôt que de compter sur
// PublicKeyCredential.prototype.toJSON(), pas encore disponible partout) — compatible
// avec toute la matrice de navigateurs qui supportent l'API WebAuthn de base.

export function estWebauthnDisponible() {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}

function bufferVersBase64url(buffer) {
  const octets = new Uint8Array(buffer);
  let binaire = "";
  for (let i = 0; i < octets.length; i++) binaire += String.fromCharCode(octets[i]);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlVersBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binaire = atob(base64 + pad);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets.buffer;
}

export function optionsInscriptionDepuisJson(json) {
  return {
    ...json,
    challenge: base64urlVersBuffer(json.challenge),
    user: { ...json.user, id: base64urlVersBuffer(json.user.id) },
    excludeCredentials: (json.excludeCredentials || []).map((c) => ({ ...c, id: base64urlVersBuffer(c.id) })),
  };
}

export function optionsAuthentificationDepuisJson(json) {
  return {
    ...json,
    challenge: base64urlVersBuffer(json.challenge),
    allowCredentials: (json.allowCredentials || []).map((c) => ({ ...c, id: base64urlVersBuffer(c.id) })),
  };
}

export function serialiserCredentialInscription(credential) {
  return {
    id: credential.id,
    rawId: bufferVersBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferVersBase64url(credential.response.attestationObject),
      clientDataJSON: bufferVersBase64url(credential.response.clientDataJSON),
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  };
}

export function serialiserCredentialAuthentification(credential) {
  return {
    id: credential.id,
    rawId: bufferVersBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferVersBase64url(credential.response.authenticatorData),
      clientDataJSON: bufferVersBase64url(credential.response.clientDataJSON),
      signature: bufferVersBase64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferVersBase64url(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
  };
}
