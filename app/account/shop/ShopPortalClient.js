"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";
import { defaultInventoryMode } from "@/lib/shopInventory";
import { saveOwnerProductContent } from "@/lib/shopProductPending";
import BuyButtonsFields from "@/components/shop/BuyButtonsFields";
import ProductGalleryEditor from "@/components/shop/ProductGalleryEditor";
import LongevityChipsEditor from "@/components/shop/LongevityChipsEditor";
import CategoryMultiSelect from "@/components/shop/CategoryMultiSelect";
import ProductTypeSelect from "@/components/shop/ProductTypeSelect";
import ProductBrandSelect from "@/components/shop/ProductBrandSelect";
import ShopPortalVariantsHook from "./ShopPortalVariantsHook";
import ProductEditMediaLongevity from "./ProductEditMediaLongevity";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";
const emptyChip = () => ({ icon_key: "heart", label: "", note: "" });

export default function ShopPortalClient({
  shops = [],
  initialProducts = [],
  categories = [],
  productBrandShops = [],
  profileId,
}) {
  const router = useRouter();
  const activeShops = useMemo(() => (shops || []).filter((s) => s.status === "active"), [shops]);
  const [brands, setBrands] = useState(productBrandShops || []);
  const [products, setProducts] = useState(initialProducts || []);
  const [name, setName] = useState("");
  const [shopId, setShopId] = useState(activeShops[0]?.id || "");
  const [brandShopId, setBrandShopId] = useState(activeShops[0]?.is_product_brand ? activeShops[0].id : "");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [productType, setProductType] = useState("other");
  const [inventoryMode, setInventoryMode] = useState("simple");
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
  const [editId, setEditId] = useState("");
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    if ((productBrandShops || []).length) {
      setBrands(productBrandShops);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("shop_shops")
      .select("id, name, slug")
      .eq("is_product_brand", true)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setBrands(data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [productBrandShops]);

  function onShopChange(id) {
    setShopId(id);
    const shop = activeShops.find((s) => s.id === id);
    if (shop?.is_product_brand) setBrandShopId(id);
  }

  function openEdit(p) {
    setError("");
    setOk("");
    setEditId(p.id);
    const pending = p.status === "approved" && p.has_pending_edit ? p.pending_snapshot || {} : {};
    setEdit({
      name: pending.name || p.name || "",
      short_description: pending.short_description || p.short_description || "",
      description: pending.description || p.description || "",
      price: (pending.price_cents ?? p.price_cents) != null ? String((pending.price_cents ?? p.price_cents) / 100) : "",
      stock_qty: String(p.stock_qty ?? 0),
      product_type: pending.product_type || p.product_type || "other",
      inventory_mode: pending.inventory_mode || p.inventory_mode || "simple",
      category_ids: pending.category_ids || p.edit_category_ids || (p.category_id ? [p.category_id] : []),
      brand_shop_id: pending.brand_shop_id || p.brand_shop_id || "",
      show_affiliate: pending.show_affiliate ?? !!p.show_affiliate,
      show_add_to_cart: pending.show_add_to_cart ?? !!p.show_add_to_cart,
      affiliate_url: pending.affiliate_url || p.affiliate_url || "",
      hide_price: pending.hide_price ?? !!p.hide_price,
      media: pending.media || p.media || [],
      chips: pending.longevity_items || p.longevity_items || [],
    });
  }

  async function saveEdit(p) {
    if (!edit?.name?.trim()) {
      setError("Name required");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const result = await saveOwnerProductContent({
      supabase,
      product: p,
      profileId,
      form: {
        ...edit,
        slug: slugifyShop(edit.name),
        inventory_mode: edit.inventory_mode || defaultInventoryMode(edit.product_type),
        brand_shop_id: edit.brand_shop_id || null,
      },
      media: edit.media || [],
      longevityItems: edit.chips || [],
      categoryIds: edit.category_ids || [],
    });
    if (!result.error && p.status !== "approved") {
      const { error: brandErr } = await supabase
        .from("shop_products")
        .update({ brand_shop_id: edit.brand_shop_id || null, updated_at: new Date().toISOString() })
        .eq("id", p.id);
      if (brandErr) {
        setBusy(false);
        setError(brandErr.message);
        return;
      }
    }
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Could not save");
      return;
    }
    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              stock_qty: result.stockQty,
              has_pending_edit: result.mode === "pending_approval",
              pending_snapshot: result.mode === "pending_approval" ? result.snapshot : null,
              brand_shop_id: p.status !== "approved" ? edit.brand_shop_id || null : x.brand_shop_id,
              ...(result.mode === "live_pending"
                ? {
                    name: edit.name.trim(),
                    short_description: edit.short_description,
                    description: edit.description,
                    product_type: edit.product_type,
                    inventory_mode: edit.inventory_mode,
                    show_affiliate: !!edit.show_affiliate,
                    show_add_to_cart: !!edit.show_add_to_cart,
                    affiliate_url: edit.affiliate_url,
                  }
                : {}),
            }
          : x
      )
    );
    setOk(
      result.mode === "pending_approval"
        ? "Update submitted for approval. Public page still shows the last approved content. Stock is live."
        : "Saved. Product is still pending first approval."
    );
    setEditId("");
    router.refresh();
  }

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
    const qty = Math.max(0, parseInt(stockQty, 10) || 0);
    const supabase = createClient();
    const { data: product, error: err } = await supabase
      .from("shop_products")
      .insert({
        name: n,
        slug: slugifyShop(n),
        short_description: shortDescription.trim(),
        description: description.trim(),
        primary_shop_id: shopId,
        brand_shop_id: brandShopId || null,
        category_id: categoryIds[0] || null,
        product_type: productType || "other",
        inventory_mode: inventoryMode || defaultInventoryMode(productType),
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: false,
        stock_qty: qty,
        track_stock: true,
        show_affiliate: !!buy.show_affiliate,
        show_add_to_cart: !!buy.show_add_to_cart,
        affiliate_url: buy.show_affiliate ? buy.affiliate_url.trim() : "",
        status: "pending",
        created_by: profileId,
        has_pending_edit: false,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, name, slug, status, primary_shop_id, brand_shop_id, short_description, description, price_cents, product_type, inventory_mode, stock_qty, category_id, show_affiliate, show_add_to_cart, affiliate_url, has_pending_edit, updated_at"
      )
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
          public_id: m.public_id || null,
          version: m.version || null,
          url: m.public_id ? null : m.url || null,
          alt_text: n,
          sort_order: i,
        }))
      );
    }
    if (chips.length) {
      await supabase.from("shop_product_longevity_items").insert(
        chips.map((c, i) => ({
          product_id: product.id,
          highlight_id: c.highlight_id || null,
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
    setStockQty("0");
    setProductType("other");
    setInventoryMode("simple");
    setCategoryIds([]);
    setGallery([]);
    setChips([]);
    setBrandShopId(activeShops.find((s) => s.id === shopId)?.is_product_brand ? shopId : "");
    setProducts((list) => [
      { ...product, variants: [], longevity_items: chips, media: gallery, edit_category_ids: categoryIds },
      ...list,
    ]);
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
            <select className={inp} value={shopId} onChange={(e) => onShopChange(e.target.value)}>
              {activeShops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-amber-800">No active shop on this account.</p>
        )}
        <ProductBrandSelect className={inp} brands={brands} value={brandShopId} onChange={setBrandShopId} />
        <label className="block text-sm font-medium">
          Name
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <ProductTypeSelect
          productType={productType}
          inventoryMode={inventoryMode}
          onChange={({ product_type, inventory_mode }) => {
            setProductType(product_type);
            setInventoryMode(inventory_mode);
          }}
        />
        <div>
          <p className="text-sm font-medium">Product categories</p>
          <p className="text-[11px] text-[#7a5c4e]">Animal / browse categories (Dog, Cat, Food, etc.)</p>
          {(categories || []).length ? (
            <CategoryMultiSelect categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
          ) : (
            <p className="mt-1 text-sm text-amber-800">No categories loaded. Refresh, or check shop_categories in Supabase.</p>
          )}
        </div>
        <label className="block text-sm font-medium">
          Short description
          <input className={inp} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea className={inp} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <ProductGalleryEditor inputId="create-gallery-url" images={gallery} onChange={setGallery} />
        <LongevityChipsEditor items={chips} onChange={setChips} draft={chipDraft} setDraft={setChipDraft} />
        <BuyButtonsFields value={buy} onChange={setBuy} />
        <label className="block text-sm font-medium">
          Price CAD
          <input type="number" step="0.01" className={inp} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Stock qty (used when there is no variety)
          <input type="number" min="0" className={inp} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
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
                  <p className="text-xs text-[#7a5c4e]">
                    /shop/p/{p.slug} · {p.status}
                    {p.product_type ? ` · ${p.product_type}` : ""}
                    {p.inventory_mode === "batch_expiry" ? " · batch + expiry" : ""}
                    {p.stock_qty != null ? ` · stock ${p.stock_qty}` : ""}
                  </p>
                  {p.has_pending_edit ? (
                    <p className="mt-1 text-xs font-semibold text-amber-800">Update awaiting admin approval</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {p.status === "approved" ? (
                    <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">View</Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => (editId === p.id ? setEditId("") : openEdit(p))}
                    className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white"
                  >
                    {editId === p.id ? "Close" : "Edit"}
                  </button>
                </div>
              </div>

              {editId === p.id && edit ? (
                <div className="mt-4 space-y-3 border-t border-[#e8d5c4] pt-4">
                  <p className="text-xs text-[#7a5c4e]">
                    {p.status === "approved"
                      ? "Content changes need admin approval. Product varieties & stock update immediately."
                      : "Not live yet — saves stay in pending review. Stock is live after approval."}
                  </p>
                  <label className="block text-sm font-medium">
                    Name
                    <input className={inp} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  </label>
                  <ProductBrandSelect
                    className={inp}
                    brands={brands}
                    value={edit.brand_shop_id}
                    onChange={(id) => setEdit({ ...edit, brand_shop_id: id })}
                  />
                  <ProductTypeSelect
                    productType={edit.product_type}
                    inventoryMode={edit.inventory_mode}
                    onChange={({ product_type, inventory_mode }) =>
                      setEdit({ ...edit, product_type, inventory_mode })
                    }
                  />
                  {(categories || []).length ? (
                    <div>
                      <p className="text-sm font-medium">Product categories</p>
                      <CategoryMultiSelect
                        categories={categories}
                        selectedIds={edit.category_ids || []}
                        onChange={(ids) => setEdit({ ...edit, category_ids: ids })}
                      />
                    </div>
                  ) : null}
                  <label className="block text-sm font-medium">
                    Short description
                    <input className={inp} value={edit.short_description} onChange={(e) => setEdit({ ...edit, short_description: e.target.value })} />
                  </label>
                  <label className="block text-sm font-medium">
                    Description
                    <textarea className={inp} rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                  </label>
                  <ProductEditMediaLongevity
                    productId={p.id}
                    persistLive={p.status !== "approved"}
                    onChange={({ media, chips }) => setEdit((cur) => (cur ? { ...cur, media, chips } : cur))}
                  />
                  <BuyButtonsFields
                    value={{
                      show_affiliate: edit.show_affiliate,
                      show_add_to_cart: edit.show_add_to_cart,
                      affiliate_url: edit.affiliate_url,
                    }}
                    onChange={(b) => setEdit({ ...edit, ...b })}
                  />
                  <label className="block text-sm font-medium">
                    Price CAD
                    <input type="number" step="0.01" className={inp} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
                  </label>
                  <label className="block text-sm font-medium">
                    Stock qty (no variety)
                    <input type="number" min="0" className={inp} value={edit.stock_qty} onChange={(e) => setEdit({ ...edit, stock_qty: e.target.value })} />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveEdit(p)}
                    className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy
                      ? "Saving…"
                      : p.status === "approved"
                        ? "Submit update for approval"
                        : "Save"}
                  </button>
                </div>
              ) : null}

              <ShopPortalVariantsHook product={p} />
            </li>
          ))}
        </ul>
        {!products.length ? <p className="mt-2 text-sm text-[#7a5c4e]">No products yet.</p> : null}
      </div>
    </div>
  );
}
