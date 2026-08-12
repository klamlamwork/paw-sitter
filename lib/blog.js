export function slugify(text) {
  return String(text || "").toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "post";
}
export function formatBlogDate(iso) {
  if (!iso) return "";
  try { return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}
