"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ProductsAdminClient({ initialProducts, brands, shops, categories, adminId }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts || []);
  const [form, setForm] = useState({
    name: "", slug: "", short_description: "", description: "", longevity_blurb: "",
    category_id: "", brand_id: "", primary_shop_id: "",
    price: "", hide_price: false, show_affiliate: true, show_add_to_cart: false,
    affiliate_url: "", image_url: "", status: "approved",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function createProduct(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOk("");
    const name = form.name.trim();
    if (!name) { setError("Name required"); setBusy(false); return; }
    const slug = slugifyShop(form.slug || name);
    const priceCents = form.price === "" || form.price == null ? null : Math.round(Number(form.price) * 100);
    const supabase = createClient();
    const payload = {
      name,
      slug,
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      longevity_blurb: form.longevity_blurb.trim(),
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      primary_shop_id: form.primary_shop_id || null,
      price_cents: Number.isFinite(priceCents) ? priceCents : null,
      currency: "CAD",
      hide_price: !!form.hide_price,
      show_affiliate: !!form.show_affiliate,
      show_add_to_cart: !!form.show_add_to_cart,
      affiliate_url: form.affiliate_url.trim(),
      status: form.status,
      created_by: adminId,
      approved_at: form.status === "approved" ? new Date().toISOString() : null,
      approved_by: form.status === "approved" ? adminId : null,
      updated_at: new Date().toISOString(),
    };
    const { data: product, error: err } = await supabase.from("shop_products").insert(payload).select("id, name, slug, status, price_cents, currency, hide_price, show_affiliate, show_add_to_cart, brand_id, primary_shop_id, category_id, updated_at").single();
    if (err) { setBusy(false); setError(err.message); return; }

    if (form.primary_shop_id) {
      await supabase.from("shop_product_shops").upsert({ product_id: product.id, shop_id: form.primary_shop_id });
    }
    if (form.image_url.trim()) {
      await supabase.from("shop_product_media").insert({
        product_id: product.id,
        url: form.image_url.trim(),
        alt_text: name,
        sort_order: 0,
      });
    }

    setBusy(false);
    setOk("Product created.");
    setForm({
      name: "", slug: "", short_description: "", description: "", longevity_blurb: "",
      category_id: "", brand_id: "", primary_shop_id: "",
      price: "", hide_price: false, show_affiliate: true, show_add_to_cart: false,
      affiliate_url: "", image_url: "", status: "approved",
    });
    router.push(`/admin/shop/products/${product.id}`);
    router.refresh();
  }

  async function setStatus(p, status) {
    const supabase = createClient();
    const patch = {
      status,
      updated_at: new Date().toISOString(),
      approved_at: status === "approved" ? new Date().toISOString() : p.approved_at || null,
      approved_by: status === "approved" ? adminId : p.approved_by || null,
    };
    const { error: err } = await supabase.from("shop_products").update(patch).eq("id", p.id);
    if (err) { setError(err.message); return; }
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, status } : x)));
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-10">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={createProduct} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold text-[#3b2a22]">Quick create product</h2>
        <label className="block text-sm font-medium">Name
          <input className={inp} required value={form.name} onChange={(e) => { set("name", e.target.value); if (!form.slug) set("slug", slugifyShop(e.target.value)); }} />
        </label>
        <label className="block text-sm font-medium">Slug
          <input className={inp + " font-mono"} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
        </label>
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
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.shop_type})</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Category
            <select className={inp} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Short description
          <input className={inp} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Longevity blurb
          <textarea className={inp} rows={2} value={form.longevity_blurb} onChange={(e) => set("longevity_blurb", e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Description
          <textarea className={inp} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Cover image URL
          <input className={inp} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Price (CAD, optional)
            <input type="number" step="0.01" min="0" className={inp} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="29.99" />
          </label>
          <label className="block text-sm font-medium">Status
            <select className={inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="draft">draft</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.hide_price} onChange={(e) => set("hide_price", e.target.checked)} /> Hide price</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_affiliate} onChange={(e) => set("show_affiliate", e.target.checked)} /> Affiliate button</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_add_to_cart} onChange={(e) => set("show_add_to_cart", e.target.checked)} /> Add to cart (Phase 2)</label>
        </div>
        {form.show_affiliate ? (
          <label className="block text-sm font-medium">Affiliate URL
            <input className={inp} value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} placeholder="https://…" />
          </label>
        ) : null}
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Create product"}
        </button>
      </form>

      <div>
        <h2 className="font-semibold text-[#3b2a22]">All products</h2>
        <ul className="mt-3 space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
              <div>
                <Link href={`/admin/shop/products/${p.id}`} className="font-semibold text-[#3b2a22] hover:text-[#c45c26]">{p.name}</Link>
                <p className="text-xs text-[#7a5c4e]">
                  /shop/p/{p.slug} · {p.shop_brands?.name || "no brand"} · {p.shop_shops?.name || "no shop"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={p.status} onChange={(e) => setStatus(p, e.target.value)} className="rounded-full border border-[#e8d5c4] px-2 py-1 text-xs">
                  <option value="draft">draft</option>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="archived">archived</option>
                </select>
                {p.status === "approved" ? (
                  <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">View</Link>
                ) : null}
                <Link href={`/admin/shop/products/${p.id}`} className="text-xs font-semibold text-[#5c4033]">Edit</Link>
              </div>
            </li>
          ))}
        </ul>
        {!products.length ? <p className="mt-3 text-sm text-[#7a5c4e]">No products yet.</p> : null}
      </div>
    </div>
  );
}
