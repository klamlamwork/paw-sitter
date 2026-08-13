"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";
import { defaultInventoryMode } from "@/lib/shopInventory";
import { snapshotFromForm, syncProductCategories } from "@/lib/shopProductPending";
import CategoryMultiSelect from "@/components/shop/CategoryMultiSelect";
import ProductTypeSelect from "@/components/shop/ProductTypeSelect";
import ProductGalleryEditor from "@/components/shop/ProductGalleryEditor";
import LongevityChipsEditor from "@/components/shop/LongevityChipsEditor";
import ShopPortalVariantsHook from "./ShopPortalVariantsHook";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";
const emptyChipDraft = () => ({ icon_key: "heart", label: "", note: "" });

export default function ShopPortalClient({
  shops,
  initialProducts,
  categories,
  productBrandShops,
  profileId,
}) {
  const router = useRouter();
  const activeShops = useMemo(() => (shops || []).filter((s) => s.status === "active"), [shops]);
  const [products, setProducts] = useState(initialProducts || []);
  const [form, setForm] = useState({
    shop_id: activeShops[0]?.id || "",
    brand_shop_id: "",
    name: "",
    slug: "",
    short_description: "",
    description: "",
    category_ids: [],
    product_type: "other",
    inventory_mode: "simple",
    price: "",
    hide_price: false,
  });
  const [createChips, setCreateChips] = useState([]);
  const [createChipDraft, setCreateChipDraft] = useState(emptyChipDraft());
  const [createGallery, setCreateGallery] = useState([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [editMedia, setEditMedia] = useState([]);
  const [editLongevity, setEditLongevity] = useState([]);
  const [editChipDraft, setEditChipDraft] = useState(emptyChipDraft());

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const selectedShop = activeShops.find((s) => s.id === form.shop_id);

  function openEdit(p) {
    setEditId(p.id);
    setError("");
    setOk("");
    setEditForm({
      name: p.edit_name || p.name || "",
      slug: p.edit_slug || p.slug || "",
      short_description: p.edit_short_description || p.short_description || "",
      description: p.edit_description || p.description || "",
      category_ids: p.edit_category_ids || [],
      product_type: p.edit_product_type || p.product_type || "other",
      inventory_mode: p.edit_inventory_mode || p.inventory_mode || "simple",
      price:
        (p.edit_price_cents ?? p.price_cents) != null
          ? String((p.edit_price_cents ?? p.price_cents) / 100)
          : "",
      hide_price: !!(p.edit_hide_price ?? p.hide_price),
      shop_id: p.primary_shop_id || "",
      brand_shop_id: p.brand_shop_id || "",
    });
    setEditMedia(
      (p.media || [])
        .filter((m) => m?.url)
        .map((m, i) => ({ url: m.url, alt_text: m.alt_text || "", sort_order: i }))
    );
    setEditLongevity(
      (p.longevity_items || []).map((it, i) => ({
        icon_key: it.icon_key || "heart",
        label: it.label,
        note: it.note || "",
        sort_order: i,
      }))
    );
    setEditChipDraft(emptyChipDraft());
  }

  async function submitEdit(p) {
    if (!editForm?.name?.trim()) {
      setError("Name required");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    const supabase = createClient();

    await supabase
      .from("shop_products")
      .update({
        product_type: editForm.product_type || "other",
        inventory_mode: editForm.inventory_mode || "simple",
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    const snap = snapshotFromForm(
      {
        ...editForm,
        slug: slugifyShop(editForm.slug || editForm.name),
        primary_shop_id: p.primary_shop_id,
        brand_shop_id: p.brand_shop_id,
      },
      editMedia.map((m, i) => ({ ...m, sort_order: i })),
      editLongevity.map((it, i) => ({ ...it, sort_order: i })),
      editForm.category_ids || []
    );
    snap.product_type = editForm.product_type || "other";
    snap.inventory_mode = editForm.inventory_mode || "simple";

    if (p.status !== "approved") {
      const { error: err } = await supabase
        .from("shop_products")
        .update({
          name: snap.name,
          slug: snap.slug,
          short_description: snap.short_description,
          description: snap.description,
          price_cents: snap.price_cents,
          hide_price: snap.hide_price,
          category_id: snap.category_id,
          product_type: snap.product_type,
          inventory_mode: snap.inventory_mode,
          status: "pending",
          has_pending_edit: false,
          pending_snapshot: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
      await supabase.from("shop_product_media").delete().eq("product_id", p.id);
      if (snap.media.length) {
        await supabase.from("shop_product_media").insert(
          snap.media.map((m, i) => ({
            product_id: p.id,
            url: m.url,
            alt_text: m.alt_text || "",
            sort_order: i,
          }))
        );
      }
      await supabase.from("shop_product_longevity_items").delete().eq("product_id", p.id);
      if (snap.longevity_items.length) {
        await supabase.from("shop_product_longevity_items").insert(
          snap.longevity_items.map((it, i) => ({
            product_id: p.id,
            icon_key: it.icon_key,
            label: it.label,
            note: it.note || "",
            sort_order: i,
          }))
        );
      }
      await syncProductCategories(supabase, p.id, snap.category_ids);
      setBusy(false);
      setOk("Saved — still pending first approval.");
      setEditId("");
      router.refresh();
      return;
    }

    const { error: err } = await supabase
      .from("shop_products")
      .update({
        has_pending_edit: true,
        pending_snapshot: snap,
        pending_submitted_at: new Date().toISOString(),
        pending_submitted_by: profileId,
        product_type: snap.product_type,
        inventory_mode: snap.inventory_mode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk("Content update submitted for approval. Gallery and longevity chips are included.");
    setEditId("");
    router.refresh();
  }

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
    if (!form.shop_id || !selectedShop) {
      setError("Select one of your shops.");
      setBusy(false);
      return;
    }

    let brandShopId = null;
    if (selectedShop.is_product_brand) brandShopId = selectedShop.id;
    else if (form.brand_shop_id) brandShopId = form.brand_shop_id;

    const slug = slugifyShop(form.slug || name);
    const priceCents =
      form.price === "" || form.price == null ? null : Math.round(Number(form.price) * 100);
    const productType = form.product_type || "other";
    const inventoryMode = form.inventory_mode || defaultInventoryMode(productType);
    const supabase = createClient();
    const gallery = (createGallery || []).filter((m) => m?.url);

    const { data: product, error: err } = await supabase
      .from("shop_products")
      .insert({
        name,
        slug,
        short_description: form.short_description.trim(),
        description: form.description.trim(),
        longevity_blurb: "",
        brand_shop_id: brandShopId,
        primary_shop_id: form.shop_id,
        category_id: (form.category_ids || [])[0] || null,
        product_type: productType,
        inventory_mode: inventoryMode,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: !!form.hide_price,
        show_affiliate: false,
        show_add_to_cart: false,
        affiliate_url: "",
        status: "pending",
        created_by: profileId,
        has_pending_edit: false,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, description, price_cents, hide_price, category_id, product_type, inventory_mode, has_pending_edit, updated_at"
      )
      .single();

    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }

    if (gallery.length) {
      const { error: mediaErr } = await supabase.from("shop_product_media").insert(
        gallery.map((m, i) => ({
          product_id: product.id,
          url: m.url,
          alt_text: m.alt_text || name,
          sort_order: i,
        }))
      );
      if (mediaErr) {
        setBusy(false);
        setError(`Product created, but gallery failed: ${mediaErr.message}`);
        router.refresh();
        return;
      }
    }

    let longevity_items = [];
    if (createChips.length) {
      const rows = createChips.map((c, i) => ({
        product_id: product.id,
        icon_key: c.icon_key || "heart",
        label: c.label,
        note: c.note || "",
        sort_order: i,
      }));
      const { data: saved, error: chipErr } = await supabase
        .from("shop_product_longevity_items")
        .insert(rows)
        .select("id, product_id, icon_key, label, note, sort_order");
      if (chipErr) {
        setBusy(false);
        setError(`Product created, but longevity chips failed: ${chipErr.message}`);
        router.refresh();
        return;
      }
      longevity_items = saved || [];
    }

    await syncProductCategories(supabase, product.id, form.category_ids || []);

    await supabase.from("shop_product_offers").upsert(
      {
        product_id: product.id,
        shop_id: form.shop_id,
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency: "CAD",
        hide_price: !!form.hide_price,
        status: "pending",
        is_default: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,shop_id" }
    );

    setBusy(false);
    setOk("Submitted. Gallery and longevity chips saved.");
    setForm((f) => ({
      ...f,
      name: "",
      slug: "",
      short_description: "",
      description: "",
      category_ids: [],
      brand_shop_id: "",
      product_type: "other",
      inventory_mode: "simple",
      price: "",
      hide_price: false,
    }));
    setCreateChips([]);
    setCreateChipDraft(emptyChipDraft());
    setCreateGallery([]);
    setProducts((list) => [
      {
        ...product,
        inventory_mode: inventoryMode,
        product_type: productType,
        edit_name: product.name,
        edit_category_ids: form.category_ids || [],
        media: gallery,
        longevity_items,
        variants: [],
      },
      ...list,
    ]);
    router.refresh();
  }

  if (!activeShops.length) {
    return <p className="mt-8 text-sm text-amber-900">None of your shops are active.</p>;
  }

  return (
    <div className="mt-10 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={createProduct} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold text-[#3b2a22]">Add product</h2>
        <label className="block text-sm font-medium">
          List under my shop
          <select className={inp} value={form.shop_id} required onChange={(e) => { set("shop_id", e.target.value); set("brand_shop_id", ""); }}>
            {activeShops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        {selectedShop && !selectedShop.is_product_brand ? (
          <label className="block text-sm font-medium">
            Link to product brand (optional)
            <select className={inp} value={form.brand_shop_id} onChange={(e) => set("brand_shop_id", e.target.value)}>
              <option value="">— none —</option>
              {productBrandShops.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        ) : null}
        <ProductTypeSelect
          productType={form.product_type}
          inventoryMode={form.inventory_mode}
          onChange={({ product_type, inventory_mode }) =>
            setForm((f) => ({ ...f, product_type, inventory_mode }))
          }
        />
        <label className="block text-sm font-medium">
          Name
          <input className={inp} required value={form.name} onChange={(e) => { set("name", e.target.value); if (!form.slug) set("slug", slugifyShop(e.target.value)); }} />
        </label>
        <div>
          <p className="text-sm font-medium">Animal / browse categories</p>
          <CategoryMultiSelect categories={categories} selectedIds={form.category_ids} onChange={(ids) => set("category_ids", ids)} />
        </div>
        <label className="block text-sm font-medium">Short description<input className={inp} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></label>
        <label className="block text-sm font-medium">Description<textarea className={inp} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>

        <ProductGalleryEditor
          inputId="create-gallery-url"
          images={createGallery}
          onChange={setCreateGallery}
        />

        <LongevityChipsEditor
          items={createChips}
          onChange={setCreateChips}
          draft={createChipDraft}
          setDraft={setCreateChipDraft}
        />

        <label className="block text-sm font-medium">Price CAD<input type="number" step="0.01" className={inp} value={form.price} onChange={(e) => set("price", e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hide_price} onChange={(e) => set("hide_price", e.target.checked)} /> Hide price</label>
        <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit product for approval"}</button>
      </form>

      <div>
        <h2 className="font-semibold text-[#3b2a22]">Your products</h2>
        <ul className="mt-3 space-y-4">
          {products.map((p) => (
            <li key={p.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-[#7a5c4e]">
                    {p.product_type || "other"} · {p.inventory_mode || "simple"}
                    {p.has_pending_edit ? " · update pending" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase">{p.status}</span>
                  {p.status === "approved" ? <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">View</Link> : null}
                  <button type="button" onClick={() => (editId === p.id ? setEditId("") : openEdit(p))} className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white">{editId === p.id ? "Close" : "Edit content"}</button>
                </div>
              </div>

              {editId === p.id && editForm ? (
                <div className="mt-4 space-y-3 border-t border-[#e8d5c4] pt-4">
                  <ProductTypeSelect
                    productType={editForm.product_type}
                    inventoryMode={editForm.inventory_mode}
                    onChange={({ product_type, inventory_mode }) =>
                      setEditForm((f) => ({ ...f, product_type, inventory_mode }))
                    }
                  />
                  <label className="block text-sm font-medium">Name<input className={inp} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
                  <div>
                    <p className="text-sm font-medium">Categories</p>
                    <CategoryMultiSelect categories={categories} selectedIds={editForm.category_ids || []} onChange={(ids) => setEditForm((f) => ({ ...f, category_ids: ids }))} />
                  </div>
                  <label className="block text-sm font-medium">Short description<input className={inp} value={editForm.short_description} onChange={(e) => setEditForm((f) => ({ ...f, short_description: e.target.value }))} /></label>
                  <label className="block text-sm font-medium">Description<textarea className={inp} rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></label>

                  <ProductGalleryEditor
                    inputId={"edit-gallery-url-" + p.id}
                    images={editMedia}
                    onChange={setEditMedia}
                  />

                  <LongevityChipsEditor
                    items={editLongevity}
                    onChange={setEditLongevity}
                    draft={editChipDraft}
                    setDraft={setEditChipDraft}
                  />

                  <label className="block text-sm font-medium">Price<input type="number" step="0.01" className={inp} value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} /></label>
                  <button type="button" disabled={busy} onClick={() => submitEdit(p)} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? "Saving…" : p.status === "approved" ? "Submit content for approval" : "Save"}
                  </button>
                </div>
              ) : null}

              <ShopPortalVariantsHook product={p} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
