"use client";

import { LONGEVITY_ICONS, longevityIconEmoji } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function LongevityChipsEditor({
  items = [],
  onChange,
  draft,
  setDraft,
}) {
  const d = draft || { icon_key: "heart", label: "", note: "" };

  function addChip() {
    const label = (d.label || "").trim();
    if (!label) return;
    onChange([
      ...(items || []),
      {
        icon_key: d.icon_key || "heart",
        label,
        note: (d.note || "").trim(),
        sort_order: (items || []).length,
      },
    ]);
    setDraft({ icon_key: d.icon_key || "heart", label: "", note: "" });
  }

  function removeAt(index) {
    onChange((items || []).filter((_, i) => i !== index).map((it, i) => ({ ...it, sort_order: i })));
  }

  return (
    <div className="rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Longevity highlights</p>
      <p className="mt-0.5 text-xs text-[#7a5c4e]">
        Circle icon + keywords. Shown in a grid on the product page.
      </p>

      {(items || []).length ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((it, i) => (
            <li
              key={(it.label || "") + i}
              className="relative flex flex-col items-center rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-2 py-3 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl ring-1 ring-[#e8d5c4]">
                {longevityIconEmoji(it.icon_key)}
              </span>
              <span className="mt-2 text-[11px] font-semibold leading-tight text-[#3b2a22]">
                {it.label}
              </span>
              <button
                type="button"
                className="absolute right-1 top-1 text-[10px] font-bold text-red-600"
                onClick={() => removeAt(i)}
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[#7a5c4e]">No chips yet.</p>
      )}

      <div className="mt-3 space-y-2 border-t border-dashed border-[#e8d5c4] pt-3">
        <div className="flex flex-wrap gap-1.5">
          {LONGEVITY_ICONS.map((ic) => (
            <button
              key={ic.key}
              type="button"
              title={ic.label}
              onClick={() => setDraft({ ...d, icon_key: ic.key })}
              className={
                "flex h-9 w-9 items-center justify-center rounded-full text-base " +
                (d.icon_key === ic.key
                  ? "bg-[#c45c26] ring-2 ring-[#c45c26]/40"
                  : "bg-[#fff8f0] ring-1 ring-[#e8d5c4]")
              }
            >
              {ic.emoji}
            </button>
          ))}
        </div>
        <input
          className={inp}
          placeholder="Keywords (e.g. Joint support)"
          value={d.label}
          onChange={(e) => setDraft({ ...d, label: e.target.value })}
        />
        <input
          className={inp}
          placeholder="Optional short note"
          value={d.note || ""}
          onChange={(e) => setDraft({ ...d, note: e.target.value })}
        />
        <button
          type="button"
          onClick={addChip}
          className="rounded-full border border-[#e8d5c4] px-4 py-1.5 text-xs font-semibold text-[#3b2a22]"
        >
          Add longevity chip
        </button>
      </div>
    </div>
  );
}
