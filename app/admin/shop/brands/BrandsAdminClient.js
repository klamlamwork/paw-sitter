"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function BrandsAdminClient({ initialBrands }) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands || []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function addBrand(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOk("");
    const n = name.trim();
    if (!n) { setError("Name required"); setBusy(false); return; }
    const s = slugifyShop(slug || n);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_brands")
      .insert({
        name: n,
        slug: s,
        logo_url: logoUrl.trim(),
        description: description.trim(),
        is_featured: featured,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    setBrands((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName(""); setSlug(""); setLogoUrl(""); setDescription(""); setFeatured(false);
    setOk("Brand created.");
    router.refresh();
  }

  async function toggleFeatured(b) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_brands")
      .update({ is_featured: !b.is_featured, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (err) { setError(err.message); return; }
    setBrands((list) => list.map((x) => (x.id === b.id ? { ...x, is_featured: !x.is_featured } : x)));
  }

  async function remove(b) {
    if (!confirm(`Delete brand "${b.name}"?`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_brands").delete().eq("id", b.id);
    if (err) { setError(err.message); return; }
    setBrands((list) => list.filter((x) => x.id !== b.id));
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}
      <form onSubmit={addBrand} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold text-[#3b2a22]">Add brand</h2>
        <label className="block text-sm font-medium">Name
          <input className={inp} value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugifyShop(e.target.value)); }} required />
        </label>
        <label className="block text-sm font-medium">Slug
          <input className={inp + " font-mono"} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Logo URL
          <input className={inp} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Description
          <textarea className={inp} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured on /shop
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Create brand"}
        </button>
      </form>
      <ul className="space-y-2">
        {brands.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-[#3b2a22]">{b.name}</p>
              <p className="text-xs text-[#7a5c4e]">/shop/brands/{b.slug}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => toggleFeatured(b)} className={"rounded-full px-3 py-1 text-xs font-semibold " + (b.is_featured ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4]")}>
                {b.is_featured ? "Featured" : "Feature"}
              </button>
              <button type="button" onClick={() => remove(b)} className="text-xs font-semibold text-red-600">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
