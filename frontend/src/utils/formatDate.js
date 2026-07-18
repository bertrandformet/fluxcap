export function formatDate(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
