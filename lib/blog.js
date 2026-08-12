export function slugify(text) {
  return String(text || "").toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "post";
}

export function formatBlogDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Safe public site origin for share links and absolute URLs. */
export function getSiteUrl() {
  const fallback = "https://paw-sitter.vercel.app";
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!raw || raw.includes("|") || raw.includes("\n") || raw.includes("NEXT_PUBLIC_") || raw.length > 200) {
    return fallback;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.origin;
  } catch {
    return fallback;
  }
}
