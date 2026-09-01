"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildProductSnapshot } from "@/lib/shopProductPending";
import { mergeBrandTagsIntoSnapshot } from "@/lib/shopProductBrandTags";
import ProductBrandTagsEditor from "@/components/shop/ProductBrandTagsEditor";

export default function ProductBrandTagsPanel() {
  const pathname = usePathname();
  const [products, setProducts] = useState([]);
  const [tags, setTags] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (pathname !== "/account/shop") return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shops } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", user.id);
      const shopIds = (shops || []).map((s) => s.id);
      if (!shopIds.length) return;
      const select = "id, name, slug, status, brand_name, has_pending_edit, pending_snapshot, primary_shop_id, brand_shop_id, short_description, description, price_cents, currency, hide_price, category_id, product_type, inventory_mode, show_affiliate, show_add_to_cart, affiliate_url";
      const [prim, brand, tagRows] = await Promise.all([
        supabase.from("shop_products").select(select).in("primary_shop_id", shopIds),
        supabase.from("shop_products").select(select).in("brand_shop_id", shopIds),
        supabase.from("shop_tags").select("id, name, slug").eq("status", "active").order("name"),
      ]);
      const map = new Map();
      for (const p of [...(prim.data || []), ...(brand.data || [])]) map.set(p.id, p);
      const list = [...map.values()];
      const ids = list.map((p) => p.id);
      let tagLinks = [];
      let media = [];
      let chips = [];
      let cats = [];
      if (ids.length) {
        const extra = await Promise.all([
          supabase.from("shop_product_tags").select("product_id, tag_id").in("product_id", ids),
          supabase.from("shop_product_media").select("product_id, public_id, version, url, alt_text, sort_order").in("product_id", ids).order("sort_order"),
          supabase.from("shop_product_longevity_items").select("product_id, icon_key, label, note, highlight_id, sort_order").in("product_id", ids).order("sort_order"),
          supabase.from("shop_product_categories").select("product_id, category_id").in("product_id", ids),
        ]);
        tagLinks = extra[0].data || [];
        media = extra[1].data || [];
        chips = extra[2].data || [];
        cats = extra[3].data || [];
      }
      const tagIdsByProduct = {};
      for (const row of tagLinks) {
        if (!tagIdsByProduct[row.product_id]) tagIdsByProduct[row.product_id] = [];
        tagIdsByProduct[row.product_id].push(row.tag_id);
      }
      const mediaByProduct = {};
      for (const row of media) {
        if (!mediaByProduct[row.product_id]) mediaByProduct[row.product_id] = [];
        mediaByProduct[row.product_id].push(row);
      }
      const chipsByProduct = {};
      for (const row of chips) {
        if (!chipsByProduct[row.product_id]) chipsByProduct[row.product_id] = [];
        chipsByProduct[row.product_id].push(row);
      }
      const catsByProduct = {};
      for (const row of cats) {
        if (!catsByProduct[row.product_id]) catsByProduct[row.product_id] = [];
        catsByProduct[row.product_id].push(row.category_id);
      }
      const next = list.map((p) => {
        const pending = p.has_pending_edit ? p.pending_snapshot || {} : {};
        return {
          ...p,
          media: mediaByProduct[p.id] || [],
          longevity_items: chipsByProduct[p.id] || [],
          category_ids: catsByProduct[p.id] || (p.category_id ? [p.category_id] : []),
          tag_ids: Array.isArray(pending.tag_ids) ? pending.tag_ids : tagIdsByProduct[p.id] || [],
          brand_name: pending.brand_name != null ? pending.brand_name : p.brand_name || "",
        };
      });
      if (cancelled) return;
      setTags(tagRows.data || []);
      setProducts(next);
      setDrafts(Object.fromEntries(next.map((p) => [p.id, { brandName: p.brand_name || "", tagIds: p.tag_ids || [] }])));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname !== "/account/shop") return null;
  if (!products.length) return null;

  async function save(product) {
    const draft = drafts[product.id] || { brandName: "", tagIds: [] };
    setBusyId(product.id);
    setError("");
    setOk("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (product.status !== "approved") {
      const { error: brandErr } = await supabase
        .from("shop_products")
        .update({ brand_name: (draft.brandName || "").trim() || null, updated_at: new Date().toISOString() })
        .eq("id", product.id);
      if (brandErr) {
        setBusyId("");
        setError(brandErr.message);
        return;
      }
      await supabase.from("shop_product_tags").delete().eq("product_id", product.id);
      if ((draft.tagIds || []).length) {
        const { error: tagErr } = await supabase.from("shop_product_tags").insert(
          draft.tagIds.map((tag_id) => ({ product_id: product.id, tag_id }))
        );
        if (tagErr) {
          setBusyId("");
          setError(tagErr.message);
          return;
        }
      }
      setBusyId("");
      setOk(`Saved brand and tags for ${product.name}. Still pending first approval.`);
      return;
    }

    const base = product.has_pending_edit && product.pending_snapshot
      ? product.pending_snapshot
      : buildProductSnapshot(product, product.media, product.longevity_items, product.category_ids);
    const snap = mergeBrandTagsIntoSnapshot(base, product, {
      brand_name: draft.brandName,
      tag_ids: draft.tagIds || [],
    });
    const { error } = await supabase
      .from("shop_products")
      .update({
        has_pending_edit: true,
        pending_snapshot: snap,
        pending_submitted_at: new Date().toISOString(),
        pending_submitted_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    setBusyId("");
    if (error) {
      setError(error.message);
      return;
    }
    setOk(`Brand and tags for ${product.name} submitted for approval. Public page keeps the last approved values.`);
  }

  return (
    <section className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Brand & tags</h2>
      <p className="mt-1 text-xs text-[#7a5c4e]">
        Pick from admin-controlled tags. Live products keep the last approved brand and tags until admin approves.
      </p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {ok ? <p className="mt-2 text-xs text-green-700">{ok}</p> : null}
      <ul className="mt-4 space-y-4">
        {products.map((product) => {
          const draft = drafts[product.id] || { brandName: "", tagIds: [] };
          return (
            <li key={product.id}>
              <p className="mb-2 text-sm font-semibold text-[#3b2a22]">{product.name}</p>
              <ProductBrandTagsEditor
                brandName={draft.brandName}
                tagIds={draft.tagIds}
                tags={tags}
                pending={product.status === "approved"}
                onChange={(next) => setDrafts((cur) => ({ ...cur, [product.id]: next }))}
              />
              <button
                type="button"
                disabled={busyId === product.id}
                onClick={() => save(product)}
                className="mt-2 rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {busyId === product.id
                  ? "Saving…"
                  : product.status === "approved"
                    ? "Submit brand & tags for approval"
                    : "Save brand & tags"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
