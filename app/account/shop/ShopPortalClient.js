"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ShopPortalClient({ shops, initialProducts, categories, profileId }) {
  const router = useRouter();
  const brandShops = (shops || []).filter((s) => s.is_product_brand && s.status === "active");
  const [products, setProducts] = useState(initialProducts || []);
  const [form, setForm] = useState({
    brand_shop_id: brandShops[0]?.id || "",
    name: "",
    slug: "",
    short_description: "",
    description: "",
    longevity_blurb: "",
    category_id: "",
    price: "",
    hide_price: false,
    image_url: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function createProduct(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const name = form.name.trim();
    if (!name) {
      setError("Name required");
      setBusy(false);
      return;
    }
    if (!form.brand_shop_id) {
      setError("Select your product brand shop.");
      setBusy(false);
      return;
    }
    const slug = slugifyShop(form.slug || name);
    const priceCents =
      form.price === "" || form.price == null ? null : Math.round(Number(form.price) * 100);
    const supabase = createClient();

    const { data: product, error: err } = await supabase
      .from("shop_products")
      .insert({
        name,
        slug,
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        longevity_blurb: form.longevity_blurb.trim(),
        brand_shop_id: form.brand_shop_id,
        category_id: form.category_id || null,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: !!form.hide_price,
        show_affiliate: false,
        show_add_to_cart: false,
        affiliate_url: "",
        status: "pending",
        created_by: profileId,
        updated_at: new Date().toISOString(),
      })
      .select("id, name, slug, status, brand_shop_id, short_description, updated_at")
      .single();

    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }

    if (form.image_url.trim()) {
      await supabase.from("shop_product_media").insert({
        product_id: product.id,
        url: form.image_url.trim(),
        alt_text: name,
        sort_order: 0,
      });
    }

    await supabase.from("shop_product_offers").upsert(
      {
        product_id: product.id,
        shop_id: form.brand_shop_id,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: !!form.hide_price,
        show_affiliate: false,
        show_add_to_cart: false,
        affiliate_url: "",
        status: "pending",
        is_default: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,shop_id" }
    );

    setBusy(false);
    setOk("Submitted for admin approval.");
    setForm((f) => ({
      ...f,
      name: "",
      slug: "",
      short_description: "",
      description: "",
      longevity_blurb: "",
      category_id: "",
      price: "",
      hide_price: false,
      image_url: "",
    }));
    setProducts((list) => [product, ...list]);
    router.refresh();
  }

  return (
    <div className="mt-10 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      {!brandShops.length ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your shop is a <strong>retailer</strong> only. To create canonical products, ask admin to
          tick <strong>This is a product brand</strong> on your shop (or create a brand shop owned by
          you). Retailer-only offer linking comes next.
        </p>
      ) : (
        <form
          onSubmit={createProduct}
          className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5"
        >
          <h2 className="font-semibold text-[#3b2a22]">Add product</h2>
          <p className="text-xs text-[#7a5c4e]">Status will be <strong>pending</strong> until admin approves.</p>
          {brandShops.length > 1 ? (
            <label className="block text-sm font-medium">
              Product brand shop
              <select
                className={inp}
                value={form.brand_shop_id}
                onChange={(e) => set("brand_shop_id", e.target.value)}
                required
              >
                {brandShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            Name
            <input
              className={inp}
              required
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!form.slug) set("slug", slugifyShop(e.target.value));
              }}
            />
          </label>
          <label className="block text-sm font-medium">
            Slug
            <input
              className={inp + " font-mono"}
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Category
            <select
              className={inp}
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Short description
            <input
              className={inp}
              value={form.short_description}
              onChange={(e) => set("short_description", e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Longevity blurb
            <textarea
              className={inp}
              rows={2}
              value={form.longevity_blurb}
              onChange={(e) => set("longevity_blurb", e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Description
            <textarea
              className={inp}
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Cover image URL
            <input
              className={inp}
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Price CAD (optional)
            <input
              type="number"
              step="0.01"
              min="0"
              className={inp}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hide_price}
              onChange={(e) => set("hide_price", e.target.checked)}
            />
            Hide price
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit product for approval"}
          </button>
        </form>
      )}

      <div>
        <h2 className="font-semibold text-[#3b2a22]">Your products</h2>
        <ul className="mt-3 space-y-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-[#7a5c4e]">/shop/p/{p.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                  {p.status}
                </span>
                {p.status === "approved" ? (
                  <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">
                    View
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {!products.length ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">No products yet.</p>
        ) : null}
      </div>
    </div>
  );
}
