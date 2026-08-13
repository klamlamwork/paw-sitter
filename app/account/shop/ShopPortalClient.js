"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";
import BuyButtonsFields from "@/components/shop/BuyButtonsFields";
import ProductGalleryEditor from "@/components/shop/ProductGalleryEditor";
import LongevityChipsEditor from "@/components/shop/LongevityChipsEditor";
import CategoryMultiSelect from "@/components/shop/CategoryMultiSelect";
import ShopPortalVariantsHook from "./ShopPortalVariantsHook";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";
const emptyChip = () => ({ icon_key: "heart", label: "", note: "" });

export default function ShopPortalClient({
  shops = [],
  initialProducts = [],
  categories = [],
  profileId,
}) {
  const router = useRouter();
  const activeShops = useMemo(
    () => (shops || []).filter((s) => s.status === "active"),
    [shops]
  );
  const [products, setProducts] = useState(initialProducts || []);
  const [name, setName] = useState("");
  const [shopId, setShopId] = useState(activeShops[0]?.id || "");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryIds, setCategoryIds] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [chips, setChips] = useState([]);
  const [chipDraft, setChipDraft] = useState(emptyChip());
  const [buy, setBuy] = useState({
    show_affiliate: false,
    show_add_to_cart: true,
    affiliate_url: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function createProduct(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const n = name.trim();
    if (!n) {
      setError("Name required");
      setBusy(false);
      return;
    }
    if (!shopId) {
      setError("No active shop. Ask admin to set your shop to active.");
      setBusy(false);
      return;
    }
    if (buy.show_affiliate && !(buy.affiliate_url || "").trim()) {
      setError("Affiliate URL required when that button is on.");
      setBusy(false);
      return;
    }
    const priceCents = price === "" ? null : Math.round(Number(price) * 100);
    const supabase = createClient();
    const { data: product, error: err } = await supabase
      .from("shop_products")
      .insert({
        name: n,
        slug: slugifyShop(n),
        short_description: shortDescription.trim(),
        description: description.trim(),
        primary_shop_id: shopId,
        category_id: categoryIds[0] || null,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: false,
        show_affiliate: !!buy.show_affiliate,
        show_add_to_cart: !!buy.show_add_to_cart,
        affiliate_url: buy.show_affiliate ? buy.affiliate_url.trim() : "",
        status: "pending",
        created_by: profileId,
        updated_at: new Date().toISOString(),
      })
      .select("id, name, slug, status, primary_shop_id, short_description, price_cents, show_affiliate, show_add_to_cart, affiliate_url, updated_at")
      .single();

    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }

    if (gallery.length) {
      await supabase.from("shop_product_media").insert(
        gallery.map((m, i) => ({
          product_id: product.id,
          url: m.url,
          alt_text: n,
          sort_order: i,
        }))
      );
    }
    if (chips.length) {
      await supabase.from("shop_product_longevity_items").insert(
        chips.map((c, i) => ({
          product_id: product.id,
          icon_key: c.icon_key || "heart",
          label: c.label,
          note: c.note || "",
          sort_order: i,
        }))
      );
    }
    if (categoryIds.length) {
      await supabase.from("shop_product_categories").insert(
        categoryIds.map((category_id) => ({ product_id: product.id, category_id }))
      );
    }
    await supabase.from("shop_product_offers").upsert(
      {
        product_id: product.id,
        shop_id: shopId,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        show_affiliate: !!buy.show_affiliate,
        show_add_to_cart: !!buy.show_add_to_cart,
        affiliate_url: buy.show_affiliate ? buy.affiliate_url.trim() : "",
        status: "pending",
        is_default: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,shop_id" }
    );

    setBusy(false);
    setOk("Product submitted for approval.");
    setName("");
    setShortDescription("");
    setDescription("");
    setPrice("");
    setCategoryIds([]);
    setGallery([]);
    setChips([]);
    setProducts((list) => [{ ...product, variants: [], longevity_items: chips, media: gallery }, ...list]);
    router.refresh();
  }

  return (
    <div className="mt-10 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={createProduct} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold text-[#3b2a22]">Add product</h2>
        {activeShops.length ? (
          <label className="block text-sm font-medium">
            Shop
            <select className={inp} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              {activeShops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-amber-800">No active shop on this account.</p>
        )}
        <label className="block text-sm font-medium">
          Name
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium">
          Short description
          <input className={inp} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea className={inp} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div>
          <p className="text-sm font-medium">Categories</p>
          <CategoryMultiSelect categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
        </div>
        <ProductGalleryEditor inputId="create-gallery-url" images={gallery} onChange={setGallery} />
        <LongevityChipsEditor items={chips} onChange={setChips} draft={chipDraft} setDraft={setChipDraft} />
        <BuyButtonsFields value={buy} onChange={setBuy} />
        <label className="block text-sm font-medium">
          Price CAD
          <input type="number" step="0.01" className={inp} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={busy || !activeShops.length}
          className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit product for approval"}
        </button>
      </form>

      <div>
        <h2 className="font-semibold text-[#3b2a22]">Your products</h2>
        <ul className="mt-3 space-y-3">
          {products.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-[#7a5c4e]">/shop/p/{p.slug} · {p.status}</p>
                </div>
                {p.status === "approved" ? (
                  <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">View</Link>
                ) : null}
              </div>
              <ShopPortalVariantsHook product={p} />
            </li>
          ))}
        </ul>
        {!products.length ? <p className="mt-2 text-sm text-[#7a5c4e]">No products yet.</p> : null}
      </div>
    </div>
  );
}
