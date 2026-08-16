"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RatingOptionsClient({ productTypes = [], initialOptions = [] }) {
  const [options, setOptions] = useState(initialOptions);
  const [form, setForm] = useState({ product_type: productTypes[0]?.value || "food", label: "", description: "", sort_order: "0", file: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const typeLabel = Object.fromEntries(productTypes.map((t) => [t.value, t.label]));

  async function addOption(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      let icon_url = "";
      if (form.file) {
        const ext = form.file.name.split(".").pop() || "png";
        const path = `${form.product_type}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("shop-rating-icons").upload(path, form.file, { upsert: true });
        if (upErr) throw upErr;
        icon_url = supabase.storage.from("shop-rating-icons").getPublicUrl(path).data?.publicUrl || "";
      }
      const { data, error: err } = await supabase.from("shop_rating_options").insert({
        product_type: form.product_type,
        label: form.label.trim(),
        description: form.description.trim(),
        icon_url,
        sort_order: Number(form.sort_order) || 0,
      }).select("*").single();
      if (err) throw err;
      setOptions((list) => [...list, data]);
      setForm((f) => ({ ...f, label: "", description: "", file: null }));
    } catch (err) {
      setError(err.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_rating_options").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setOptions((list) => list.filter((o) => o.id !== id));
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={addOption} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-white p-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <label className="block text-sm">Product type
          <select className="mt-1 w-full border border-[#e8d5c4] px-3 py-2" value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} required>
            {productTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">Label
          <input className="mt-1 w-full border border-[#e8d5c4] px-3 py-2" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Tasty" required />
        </label>
        <label className="block text-sm">Short description
          <input className="mt-1 w-full border border-[#e8d5c4] px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Pet enjoyed the flavour" />
        </label>
        <label className="block text-sm">Icon
          <input type="file" accept="image/*" className="mt-1 w-full text-sm" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
        </label>
        <button type="submit" disabled={busy || !form.product_type} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Add option"}</button>
      </form>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm">
            <span className="flex items-center gap-2">{o.icon_url ? <img src={o.icon_url} alt="" className="h-6 w-6 object-contain" /> : null}<span><strong>{o.label}</strong> · {typeLabel[o.product_type] || o.product_type}{o.description ? <span className="block text-xs text-[#7a5c4e]">{o.description}</span> : null}</span></span>
            <button type="button" onClick={() => remove(o.id)} className="text-xs font-semibold text-red-600">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
