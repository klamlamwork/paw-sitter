"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LONGEVITY_ICONS, longevityIconEmoji } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

function IconPreview({ item, size = "h-12 w-12 text-xl" }) {
  if (item.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.icon_url} alt="" className={`${size} rounded-full object-cover ring-1 ring-[#e8d5c4]`} />
    );
  }
  return (
    <span className={`flex ${size} items-center justify-center rounded-full bg-white ring-1 ring-[#e8d5c4]`}>
      {longevityIconEmoji(item.icon_key)}
    </span>
  );
}

export default function LongevityAdminClient({ initialItems }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [iconKey, setIconKey] = useState("heart");
  const [iconFile, setIconFile] = useState(null);
  const [sortOrder, setSortOrder] = useState(String((initialItems || []).length + 1));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadIcon(file) {
    if (!file) return "";
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `icons/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("shop-longevity-icons").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("shop-longevity-icons").getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function addItem(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const n = label.trim();
    if (!n) {
      setError("Name required");
      setBusy(false);
      return;
    }
    try {
      const icon_url = await uploadIcon(iconFile);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("shop_longevity_highlights")
        .insert({
          label: n,
          note: note.trim(),
          icon_key: iconKey,
          icon_url,
          sort_order: parseInt(sortOrder, 10) || 0,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (err) throw err;
      setItems((list) => [...list, data].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)));
      setLabel("");
      setNote("");
      setIconFile(null);
      setSortOrder(String((items.length || 0) + 2));
      setOk("Highlight added. Shops can select it on products.");
      router.refresh();
    } catch (e2) {
      setError(e2.message || "Could not save highlight");
    }
    setBusy(false);
  }

  async function patchItem(item, fields) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_longevity_highlights")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (err) {
      setError(err.message);
      return;
    }
    setItems((list) => list.map((x) => (x.id === item.id ? { ...x, ...fields } : x)));
  }

  async function replaceIcon(item, file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const icon_url = await uploadIcon(file);
      await patchItem(item, { icon_url });
      setOk("Icon updated.");
    } catch (e2) {
      setError(e2.message || "Upload failed");
    }
    setBusy(false);
  }

  async function remove(item) {
    if (!confirm(`Delete "${item.label}"? Shops will no longer be able to pick it.`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_longevity_highlights").delete().eq("id", item.id);
    if (err) {
      setError(err.message);
      return;
    }
    setItems((list) => list.filter((x) => x.id !== item.id));
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={addItem} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Add highlight</h2>
        <label className="block text-sm font-medium">
          Name
          <input className={inp} value={label} required onChange={(e) => setLabel(e.target.value)} placeholder="Joint support" />
        </label>
        <label className="block text-sm font-medium">
          Optional note
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div>
          <p className="text-sm font-medium">Preset emoji (used if no custom icon)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LONGEVITY_ICONS.map((ic) => (
              <button
                key={ic.key}
                type="button"
                title={ic.label}
                onClick={() => setIconKey(ic.key)}
                className={
                  "flex h-9 w-9 items-center justify-center rounded-full text-base " +
                  (iconKey === ic.key ? "bg-[#c45c26] ring-2 ring-[#c45c26]/40" : "bg-white ring-1 ring-[#e8d5c4]")
                }
              >
                {ic.emoji}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm font-medium">
          Custom icon (optional PNG/JPG/SVG)
          <input
            type="file"
            accept="image/*"
            className={inp}
            onChange={(e) => setIconFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="block text-sm font-medium">
          Sort order
          <input type="number" className={inp} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Create highlight"}
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <IconPreview item={it} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#3b2a22]">{it.label}</p>
              {it.note ? <p className="text-xs text-[#7a5c4e]">{it.note}</p> : null}
              <label className="mt-1 block text-[11px] font-medium text-[#7a5c4e]">
                Replace icon
                <input type="file" accept="image/*" className="mt-0.5 block text-xs" onChange={(e) => replaceIcon(it, e.target.files?.[0])} />
              </label>
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={!!it.is_active} onChange={(e) => patchItem(it, { is_active: e.target.checked })} />
              Active
            </label>
            <button type="button" onClick={() => remove(it)} className="text-xs font-semibold text-red-600">
              Delete
            </button>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="text-sm text-[#7a5c4e]">No highlights yet.</p> : null}
    </div>
  );
}
