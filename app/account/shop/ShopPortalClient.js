"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LONGEVITY_ICONS, longevityIconEmoji, slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ShopPortalClient({
  shops,
  initialProducts,
  categories,
  productBrandShops,
  profileId,
}) {
  const router = useRouter();
  const activeShops = useMemo(
    () => (shops || []).filter((s) => s.status === "active"),
    [shops]
  );
  const [products, setProducts] = useState(initialProducts || []);
  const [form, setForm] = useState({
    shop_id: activeShops[0]?.id || "",
    brand_shop_id: "",
    name: "",
    slug: "",
    short_description: "",
    description: "",
    category_id: "",
    price: "",
    hide_price: false,
    image_url: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [chipDraft, setChipDraft] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedShop = activeShops.find((s) => s.id === form.shop_id);

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
    if (selectedShop.is_product_brand) {
      brandShopId = selectedShop.id;
    } else if (form.brand_shop_id) {
      brandShopId = form.brand_shop_id;
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
        longevity_blurb: "",
        brand_shop_id: brandShopId,
        primary_shop_id: form.shop_id,
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
      .select(
        "id, name, slug, status, brand_shop_id, primary_shop_id, short_description, updated_at"
      )
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
        shop_id: form.shop_id,
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
    setOk("Submitted for admin approval. Add longevity chips below.");
    setForm((f) => ({
      ...f,
      name: "",
      slug: "",
      short_description: "",
      description: "",
      category_id: "",
      brand_shop_id: "",
      price: "",
      hide_price: false,
      image_url: "",
    }));
    setProducts((list) => [{ ...product, longevity_items: [] }, ...list]);
    router.refresh();
  }

  function draftFor(productId) {
    return (
      chipDraft[productId] || {
        icon_key: "heart",
        label: "",
        note: "",
      }
    );
  }

  function setDraft(productId, patch) {
    setChipDraft((d) => ({
      ...d,
      [productId]: { ...draftFor(productId), ...patch },
    }));
  }

  async function addChip(product) {
    const d = draftFor(product.id);
    const label = d.label.trim();
    if (!label) {
      setError("Longevity keywords required");
      return;
    }
    setError("");
    const supabase = createClient();
    const sort_order = (product.longevity_items || []).length;
    const { data, error: err } = await supabase
      .from("shop_product_longevity_items")
      .insert({
        product_id: product.id,
        icon_key: d.icon_key || "heart",
        label,
        note: (d.note || "").trim(),
        sort_order,
      })
      .select("id, product_id, icon_key, label, note, sort_order")
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) =>
      list.map((p) =>
        p.id === product.id
          ? { ...p, longevity_items: [...(p.longevity_items || []), data] }
          : p
      )
    );
    setDraft(product.id, { label: "", note: "" });
    router.refresh();
  }

  async function removeChip(product, itemId) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_product_longevity_items")
      .delete()
      .eq("id", itemId);
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) =>
      list.map((p) =>
        p.id === product.id
          ? {
              ...p,
              longevity_items: (p.longevity_items || []).filter((x) => x.id !== itemId),
            }
          : p
      )
    );
  }

  if (!activeShops.length) {
    return (
      <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        None of your shops are <strong>active</strong>. Ask admin to set status to active.
      </p>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form
        onSubmit={createProduct}
        className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5"
      >
        <h2 className="font-semibold text-[#3b2a22]">Add product</h2>
        <p className="text-xs text-[#7a5c4e]">
          After submit, add longevity chips (circle icon + keywords) on each product below.
        </p>

        <label className="block text-sm font-medium">
          List under my shop
          <select
            className={inp}
            value={form.shop_id}
            onChange={(e) => {
              set("shop_id", e.target.value);
              set("brand_shop_id", "");
            }}
            required
          >
            {activeShops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.is_product_brand ? "product brand" : "retailer"})
              </option>
            ))}
          </select>
        </label>

        {selectedShop && !selectedShop.is_product_brand ? (
          <label className="block text-sm font-medium">
            Link to product brand (optional)
            <select
              className={inp}
              value={form.brand_shop_id}
              onChange={(e) => set("brand_shop_id", e.target.value)}
            >
              <option value="">— none —</option>
              {productBrandShops.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
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

      <div>
        <h2 className="font-semibold text-[#3b2a22]">Your products & longevity chips</h2>
        <ul className="mt-3 space-y-4">
          {products.map((p) => {
            const d = draftFor(p.id);
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-[#7a5c4e]">/shop/p/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                      {p.status}
                    </span>
                    {p.status === "approved" ? (
                      <Link
                        href={`/shop/p/${p.slug}`}
                        className="text-xs font-semibold text-[#c45c26]"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#7a5c4e]">
                  Longevity chips (circle + keywords)
                </p>
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(p.longevity_items || []).map((it) => (
                    <li
                      key={it.id}
                      className="relative flex flex-col items-center rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-2 py-3 text-center"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-sm ring-1 ring-[#e8d5c4]">
                        {longevityIconEmoji(it.icon_key)}
                      </span>
                      <span className="mt-2 text-[11px] font-semibold leading-tight text-[#3b2a22]">
                        {it.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChip(p, it.id)}
                        className="absolute right-1 top-1 text-[10px] font-bold text-red-600"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 space-y-2 rounded-xl border border-dashed border-[#e8d5c4] p-3">
                  <p className="text-xs font-medium text-[#5c4033]">Add chip</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LONGEVITY_ICONS.map((ic) => (
                      <button
                        key={ic.key}
                        type="button"
                        onClick={() => setDraft(p.id, { icon_key: ic.key })}
                        title={ic.label}
                        className={
                          "flex h-9 w-9 items-center justify-center rounded-full text-base " +
                          (d.icon_key === ic.key
                            ? "bg-[#c45c26] ring-2 ring-[#c45c26]/40"
                            : "bg-[#fff8f0] ring-1 ring-[#e8d5c4]")
                        }
                      >
                        {ic.emoji}
                      </button>
                    ))}
                  </div>
                  <input
                    className={inp}
                    placeholder="Keywords (e.g. Joint support)"
                    value={d.label}
                    onChange={(e) => setDraft(p.id, { label: e.target.value })}
                  />
                  <input
                    className={inp}
                    placeholder="Optional short note"
                    value={d.note}
                    onChange={(e) => setDraft(p.id, { note: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => addChip(p)}
                    className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Add longevity chip
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {!products.length ? (
          <p className="mt-2 text-sm text-[#7a5c4e]">No products yet.</p>
        ) : null}
      </div>
    </div>
  );
}
