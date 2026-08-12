"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ProductEditClient({ product, brands, shops, categories, adminId }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product.name || "",
    slug: product.slug || "",
    short_description: product.short_description || "",
    description: product.description || "",
    longevity_blurb: product.longevity_blurb || "",
    category_id: product.category_id || "",
    brand_id: product.brand_id || "",
    primary_shop_id: product.primary_shop_id || "",
    price: product.price_cents != null ? String(product.price_cents / 100) : "",
    hide_price: !!product.hide_price,
    show_affiliate: !!product.show_affiliate,
    show_add_to_cart: !!product.show_add_to_cart,
    affiliate_url: product.affiliate_url || "",
    status: product.status || "draft",
    seo_title: product.seo_title || "",
    seo_description: product.seo_description || "",
  });
  const [media, setMedia] = useState(product.shop_product_media || []);
  const [newImage, setNewImage] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOk("");
    const priceCents = form.price === "" ? null : Math.round(Number(form.price) * 100);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_products")
      .update({
        name: form.name.trim(),
        slug: slugifyShop(form.slug || form.name),
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        longevity_blurb: form.longevity_blurb.trim(),
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        primary_shop_id: form.primary_shop_id || null,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        hide_price: !!form.hide_price,
        show_affiliate: !!form.show_affiliate,
        show_add_to_cart: !!form.show_add_to_cart,
        affiliate_url: form.affiliate_url.trim(),
        status: form.status,
        seo_title: form.seo_title.trim(),
        seo_description: form.seo_description.trim(),
        approved_at: form.status === "approved" ? product.approved_at || new Date().toISOString() : product.approved_at,
        approved_by: form.status === "approved" ? product.approved_by || adminId : product.approved_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (err) { setBusy(false); setError(err.message); return; }
    if (form.primary_shop_id) {
      await supabase.from("shop_product_shops").upsert({ product_id: product.id, shop_id: form.primary_shop_id });
    }
    setBusy(false);
    setOk("Saved.");
    router.refresh();
  }

  async function addImage(e) {
    e.preventDefault();
    if (!newImage.trim()) return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_product_media")
      .insert({ product_id: product.id, url: newImage.trim(), alt_text: form.name, sort_order: media.length })
      .select("*")
      .single();
    if (err) { setError(err.message); return; }
    setMedia((m) => [...m, data]);
    setNewImage("");
  }

  async function removeImage(id) {
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_product_media").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setMedia((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-8 space-y-6">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}
      {form.status === "approved" ? (
        <p className="text-sm">
          <Link href={`/shop/p/${form.slug}`} className="font-semibold text-[#c45c26] hover:underline">View public PDP →</Link>
        </p>
      ) : null}
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-white p-5">
        <label className="block text-sm font-medium">Name<input className={inp} value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
        <label className="block text-sm font-medium">Slug<input className={inp + " font-mono"} value={form.slug} onChange={(e) => set("slug", e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">Brand
            <select className={inp} value={form.brand_id} onChange={(e) => set("brand_id", e.target.value)}>
              <option value="">—</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Primary shop
            <select className={inp} value={form.primary_shop_id} onChange={(e) => set("primary_shop_id", e.target.value)}>
              <option value="">—</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Category
            <select className={inp} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Short description<textarea className={inp} rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></label>
        <label className="block text-sm font-medium">Longevity blurb<textarea className={inp} rows={2} value={form.longevity_blurb} onChange={(e) => set("longevity_blurb", e.target.value)} /></label>
        <label className="block text-sm font-medium">Description<textarea className={inp} rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="block text-sm font-medium">Price CAD<input type="number" step="0.01" className={inp} value={form.price} onChange={(e) => set("price", e.target.value)} /></label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.hide_price} onChange={(e) => set("hide_price", e.target.checked)} /> Hide price</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_affiliate} onChange={(e) => set("show_affiliate", e.target.checked)} /> Affiliate button</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_add_to_cart} onChange={(e) => set("show_add_to_cart", e.target.checked)} /> Add to cart</label>
        </div>
        <label className="block text-sm font-medium">Affiliate URL<input className={inp} value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} /></label>
        <label className="block text-sm font-medium">Status
          <select className={inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">draft</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="block text-sm font-medium">SEO title<input className={inp} value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} /></label>
        <label className="block text-sm font-medium">SEO description<textarea className={inp} rows={2} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} /></label>
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save product"}
        </button>
      </form>

      <section className="rounded-2xl border border-[#e8d5c4] bg-white p-5">
        <h2 className="font-semibold">Gallery</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {media.map((m) => (
            <li key={m.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#e8d5c4]">
              <img src={m.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeImage(m.id)} className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white">x</button>
            </li>
          ))}
        </ul>
        <form onSubmit={addImage} className="mt-3 flex gap-2">
          <input className={inp + " flex-1"} value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="Image URL" />
          <button type="submit" className="rounded-full border border-[#e8d5c4] px-4 text-sm font-semibold">Add</button>
        </form>
      </section>
    </div>
  );
}
