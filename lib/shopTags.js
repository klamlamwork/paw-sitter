export function slugifyTag(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function uniqueTags(list) {
  const seen = new Set();
  const out = [];
  for (const tag of list || []) {
    const slug = tag.slug || slugifyTag(tag.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ ...tag, slug });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
