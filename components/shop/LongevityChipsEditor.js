"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { longevityIconEmoji } from "@/lib/shop";

function Preview({ option }) {
  const src = option.icon_url || (/^https?:\/\//i.test(option.icon_key || "") ? option.icon_key : "");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-[#e8d5c4]" />
    );
  }
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl ring-1 ring-[#e8d5c4]">
      {longevityIconEmoji(option.icon_key)}
    </span>
  );
}

export default function LongevityChipsEditor({ items = [], onChange }) {
  const [options, setOptions] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shop_longevity_highlights")
        .select("id, label, note, icon_key, icon_url, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("label");
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      setOptions(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = new Set(
    (items || []).map((it) => it.highlight_id || it.id).filter(Boolean)
  );
  const selectedLabels = new Set((items || []).map((it) => (it.label || "").toLowerCase()));

  function isSelected(opt) {
    return selectedIds.has(opt.id) || selectedLabels.has((opt.label || "").toLowerCase());
  }

  function toggle(opt) {
    if (isSelected(opt)) {
      onChange(
        (items || []).filter(
          (it) => it.highlight_id !== opt.id && (it.label || "").toLowerCase() !== (opt.label || "").toLowerCase()
        )
      );
      return;
    }
    onChange([
      ...(items || []),
      {
        highlight_id: opt.id,
        icon_key: opt.icon_url || opt.icon_key || "heart",
        label: opt.label,
        note: opt.note || "",
        sort_order: (items || []).length,
      },
    ]);
  }

  return (
    <div className="rounded-xl border border-[#e8d5c4] bg-white p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Longevity highlights</p>
      <p className="mt-0.5 text-xs text-[#7a5c4e]">
        Choose one or more from the admin list. Shops cannot create new highlights.
      </p>
      {loadError ? <p className="mt-2 text-xs text-red-700">{loadError}</p> : null}
      {!options.length && !loadError ? (
        <p className="mt-2 text-xs text-[#7a5c4e]">No highlights yet. Ask admin to add them in Admin → Shop → Longevity highlights.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {options.map((opt) => {
            const on = isSelected(opt);
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => toggle(opt)}
                  className={
                    "flex w-full flex-col items-center rounded-xl border px-2 py-3 text-center " +
                    (on ? "border-[#c45c26] bg-[#fff1e6]" : "border-[#e8d5c4] bg-[#fff8f0]")
                  }
                >
                  <Preview option={opt} />
                  <span className="mt-2 text-[11px] font-semibold leading-tight text-[#3b2a22]">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
