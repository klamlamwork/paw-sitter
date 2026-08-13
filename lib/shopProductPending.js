/** Helpers for shop product live vs pending snapshots */

export function buildProductSnapshot(product, media = [], longevityItems = [], categoryIds = []) {
  return {
    name: product.name || "",
    slug: product.slug || "",
    short_description: product.short_description || "",
    description: product.description || "",
    price_cents: product.price_cents ?? null,
    currency: product.currency || "CAD",
    hide_price: !!product.hide_price,
    category_id: categoryIds[0] || product.category_id || null,
    category_ids: categoryIds.length ? categoryIds : product.category_id ? [product.category_id] : [],
    brand_shop_id: product.brand_shop_id || null,
    primary_shop_id: product.primary_shop_id || null,
    media: (media || []).map((m, i) => ({
      url: m.url,
      alt_text: m.alt_text || "",
      sort_order: m.sort_order ?? i,
    })),
    longevity_items: (longevityItems || []).map((it, i) => ({
      icon_key: it.icon_key || "heart",
      label: it.label || "",
      note: it.note || "",
      sort_order: it.sort_order ?? i,
    })),
  };
}

export function snapshotFromForm(form, media, longevityItems, categoryIds = []) {
  const priceCents =
    form.price === "" || form.price == null ? null : Math.round(Number(form.price) * 100);
  const cats = (categoryIds || []).filter(Boolean);
  return {
    name: (form.name || "").trim(),
    slug: (form.slug || "").trim(),
    short_description: (form.short_description || "").trim(),
    description: (form.description || "").trim(),
    price_cents: Number.isFinite(priceCents) ? priceCents : null,
    currency: "CAD",
    hide_price: !!form.hide_price,
    category_id: cats[0] || form.category_id || null,
    category_ids: cats,
    brand_shop_id: form.brand_shop_id || null,
    primary_shop_id: form.primary_shop_id || form.shop_id || null,
    media: (media || []).map((m, i) => ({
      url: m.url,
      alt_text: m.alt_text || "",
      sort_order: m.sort_order ?? i,
    })),
    longevity_items: (longevityItems || []).map((it, i) => ({
      icon_key: it.icon_key || "heart",
      label: it.label || "",
      note: it.note || "",
      sort_order: it.sort_order ?? i,
    })),
  };
}

export async function applySnapshotToProduct(supabase, productId, snap) {
  const cats = snap.category_ids || (snap.category_id ? [snap.category_id] : []);
  const { error: pErr } = await supabase
    .from("shop_products")
    .update({
      name: snap.name,
      slug: snap.slug,
      short_description: snap.short_description || "",
      description: snap.description || "",
      price_cents: snap.price_cents,
      currency: snap.currency || "CAD",
      hide_price: !!snap.hide_price,
      category_id: cats[0] || null,
      status: "approved",
      has_pending_edit: false,
      pending_snapshot: null,
      pending_submitted_at: null,
      pending_submitted_by: null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (pErr) return pErr;

  await supabase.from("shop_product_media").delete().eq("product_id", productId);
  const media = snap.media || [];
  if (media.length) {
    const { error: mErr } = await supabase.from("shop_product_media").insert(
      media.map((m, i) => ({
        product_id: productId,
        url: m.url,
        alt_text: m.alt_text || "",
        sort_order: m.sort_order ?? i,
      }))
    );
    if (mErr) return mErr;
  }

  await supabase.from("shop_product_longevity_items").delete().eq("product_id", productId);
  const items = snap.longevity_items || [];
  if (items.length) {
    const { error: lErr } = await supabase.from("shop_product_longevity_items").insert(
      items.map((it, i) => ({
        product_id: productId,
        icon_key: it.icon_key || "heart",
        label: it.label,
        note: it.note || "",
        sort_order: it.sort_order ?? i,
      }))
    );
    if (lErr) return lErr;
  }

  await supabase.from("shop_product_categories").delete().eq("product_id", productId);
  if (cats.length) {
    const { error: cErr } = await supabase.from("shop_product_categories").insert(
      cats.map((category_id) => ({ product_id: productId, category_id }))
    );
    if (cErr) return cErr;
  }

  return null;
}

export async function syncProductCategories(supabase, productId, categoryIds) {
  const cats = [...new Set((categoryIds || []).filter(Boolean))];
  await supabase.from("shop_product_categories").delete().eq("product_id", productId);
  if (cats.length) {
    await supabase.from("shop_product_categories").insert(
      cats.map((category_id) => ({ product_id: productId, category_id }))
    );
  }
  await supabase
    .from("shop_products")
    .update({ category_id: cats[0] || null, updated_at: new Date().toISOString() })
    .eq("id", productId);
}
