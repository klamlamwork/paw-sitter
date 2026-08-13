"use client";

/** Multi-select categories with parent → child labels */
export default function CategoryMultiSelect({ categories = [], selectedIds = [], onChange }) {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));

  function label(c) {
    if (c.parent_id && byId[c.parent_id]) {
      return `${byId[c.parent_id].name} → ${c.name}`;
    }
    return c.name;
  }

  // Parents first, then their children
  const ordered = [...categories].sort((a, b) => {
    const ap = a.parent_id || "";
    const bp = b.parent_id || "";
    if (ap !== bp) {
      if (!ap) return -1;
      if (!bp) return 1;
      return (byId[ap]?.name || "").localeCompare(byId[bp]?.name || "");
    }
    return (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name);
  });

  const selected = new Set(selectedIds || []);

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[#e8d5c4] bg-white p-2">
      {ordered.map((c) => (
        <label
          key={c.id}
          className={
            "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#fff8f0] " +
            (c.parent_id ? "pl-6" : "font-medium")
          }
        >
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggle(c.id)}
          />
          <span className="text-[#3b2a22]">{label(c)}</span>
        </label>
      ))}
      {!ordered.length ? (
        <p className="px-2 py-1 text-xs text-[#7a5c4e]">No categories yet.</p>
      ) : null}
    </div>
  );
}
