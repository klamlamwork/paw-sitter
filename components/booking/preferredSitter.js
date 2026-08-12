/** Helpers for preferred sitter preselect on booking. */

export function sortPreferredFirst(list, preferredSitterId) {
  if (!preferredSitterId || !Array.isArray(list)) return list || [];
  const id = String(preferredSitterId);
  return [...list].sort((a, b) => {
    const ap = String(a.id) === id ? 0 : 1;
    const bp = String(b.id) === id ? 0 : 1;
    return ap - bp;
  });
}

export function isPreferredAvailable(list, preferredSitterId) {
  if (!preferredSitterId) return false;
  const id = String(preferredSitterId);
  return (list || []).some((s) => String(s.id) === id);
}
