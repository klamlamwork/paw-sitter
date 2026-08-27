function snapshotMedia(media) {
  return (media || []).map((m, i) => ({
    public_id: m.public_id || null,
    version: m.version || null,
    url: m.public_id ? null : m.url || null,
    alt_text: m.alt_text || "",
    sort_order: m.sort_order ?? i,
  }));
}

function snapshotChips(longevityItems) {
  return (longevityItems || []).map((it, i) => ({
    icon_key: it.icon_key || "heart",
    label: it.label || "",
    note: it.note || "",
    highlight_id: it.highlight_id || null,
    sort_order: it.sort_order ?? i,
  }));
}

export function buildProductSnapshot(product, media = [], longevityItems = [], categoryIds = []) {
  return {
    name: product.name || "",
    slug: product.slug || "",
    short_description: product.short_description || "",
    description: product.description || "",
    price_cents: product.price_cents ?? null,
    currency: product.currency || "CAD",
    hide_price: !!product.hide_price,
    category_id: (categoryIds || [])[0] || product.category_id || null,
    category_ids: categoryIds.length ? categoryIds : product.category_id ? [product.category_id] : [],
    brand_shop_id: product.brand_shop_id || null,
    primary_shop_id: product.primary_shop_id || null,
    product_type: product.product_type || "other",
    inventory_mode: product.inventory_mode || "simple",
    show_affiliate: !!product.show_affiliate,
    show_add_to_cart: !!product.show_add_to_cart,
    affiliate_url: product.affiliate_url || "",
    media: snapshotMedia(media),
    longevity_items: snapshotChips(longevityItems),
  };
}

export function snapshotFromForm(form, media, longevityItems, categoryIds = []) {
  const priceCents =
    form.price === "" || form.price == null ? null : Math.round(Number(form.price) * 100);
  const cats = (categoryIds || form.category_ids || []).filter(Boolean);
  return {
    name: (form.name || "").trim(),
    slug: (form.slug || "").trim(),
    short_description: (form.short_description || "").trim(),
    description: (form.description || "").trim(),
    price_cents: Number.isFinite(priceCents) ? priceCents : null,
    currency: form.currency || "CAD",
    hide_price: !!form.hide_price,
    category_id: cats[0] || null,
    category_ids: cats,
    brand_shop_id: form.brand_shop_id || null,
    primary_shop_id: form.primary_shop_id || form.shop_id || null,
    product_type: form.product_type || "other",
    inventory_mode: form.inventory_mode || "simple",
    show_affiliate: !!form.show_affiliate,
    show_add_to_cart: !!form.show_add_to_cart,
    affiliate_url: form.show_affiliate ? (form.affiliate_url || "").trim() : "",
    media: snapshotMedia(media),
    longevity_items: snapshotChips(longevityItems),
  };
}

function mediaRows(productId, media) {
  return (media || []).map((m, i) => ({
    product_id: productId,
    public_id: m.public_id || null,
    version: m.version || null,
    url: m.public_id ? null : m.url || null,
    alt_text: m.alt_text || "",
    sort_order: i,
  }));
}

export async function applySnapshotToProduct(supabase, productId, snap) {
  const cats = snap.category_ids || (snap.category_id ? [snap.category_id] : []);
  const patch = {
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
  };
  if (snap.product_type) patch.product_type = snap.product_type;
  if (snap.inventory_mode) patch.inventory_mode = snap.inventory_mode;
  if (snap.show_affiliate != null) patch.show_affiliate = !!snap.show_affiliate;
  if (snap.show_add_to_cart != null) patch.show_add_to_cart = !!snap.show_add_to_cart;
  if (snap.affiliate_url != null) patch.affiliate_url = snap.affiliate_url || "";
  const { error: pErr } = await supabase.from("shop_products").update(patch).eq("id", productId);
  if (pErr) return pErr;

  if (Array.isArray(snap.media)) {
    await supabase.from("shop_product_media").delete().eq("product_id", productId);
    if (snap.media.length) {
      const { error: mErr } = await supabase.from("shop_product_media").insert(mediaRows(productId, snap.media));
      if (mErr) return mErr;
    }
  }

  await supabase.from("shop_product_longevity_items").delete().eq("product_id", productId);
  const items = snap.longevity_items || [];
  if (items.length) {
    const { error: lErr } = await supabase.from("shop_product_longevity_items").insert(
      items.map((it, i) => ({
        product_id: productId,
        highlight_id: it.highlight_id || null,
        icon_key: it.icon_key || "heart",
        label: it.label,
        note: it.note || "",
        sort_order: i,
      }))
    );
    if (lErr) return lErr;
  }

  return syncProductCategories(supabase, productId, cats);
}

export async function syncProductCategories(supabase, productId, categoryIds) {
  const cats = (categoryIds || []).filter(Boolean);
  await supabase.from("shop_product_categories").delete().eq("product_id", productId);
  if (cats.length) {
    const { error } = await supabase
      .from("shop_product_categories")
      .insert(cats.map((category_id) => ({ product_id: productId, category_id })));
    if (error) return error;
  }
  const { error } = await supabase
    .from("shop_products")
    .update({ category_id: cats[0] || null, updated_at: new Date().toISOString() })
    .eq("id", productId);
  return error || null;
}

export async function saveOwnerProductContent({
  supabase,
  product,
  form,
  media = [],
  longevityItems = [],
  categoryIds = [],
  profileId,
}) {
  const stockQty = Math.max(0, parseInt(form.stock_qty, 10) || 0);
  const { error: stockErr } = await supabase
    .from("shop_products")
    .update({
      stock_qty: stockQty,
      track_stock: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (stockErr) return { mode: "error", error: stockErr };

  const snap = snapshotFromForm(
    {
      ...form,
      primary_shop_id: product.primary_shop_id,
      brand_shop_id: product.brand_shop_id,
    },
    media,
    longevityItems,
    categoryIds
  );

  if (product.status !== "approved") {
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
        show_affiliate: snap.show_affiliate,
        show_add_to_cart: snap.show_add_to_cart,
        affiliate_url: snap.affiliate_url,
        status: "pending",
        has_pending_edit: false,
        pending_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (err) return { mode: "error", error: err };
    await supabase.from("shop_product_media").delete().eq("product_id", product.id);
    if (snap.media.length) {
      const { error: mErr } = await supabase.from("shop_product_media").insert(mediaRows(product.id, snap.media));
      if (mErr) return { mode: "error", error: mErr, snapshot: snap, stockQty };
    }
    await supabase.from("shop_product_longevity_items").delete().eq("product_id", product.id);
    if (snap.longevity_items.length) {
      await supabase.from("shop_product_longevity_items").insert(
        snap.longevity_items.map((it, i) => ({
          product_id: product.id,
          highlight_id: it.highlight_id || null,
          icon_key: it.icon_key,
          label: it.label,
          note: it.note || "",
          sort_order: i,
        }))
      );
    }
    await syncProductCategories(supabase, product.id, snap.category_ids);
    return { mode: "live_pending", error: null, snapshot: snap, stockQty };
  }

  const { error } = await supabase
    .from("shop_products")
    .update({
      has_pending_edit: true,
      pending_snapshot: snap,
      pending_submitted_at: new Date().toISOString(),
      pending_submitted_by: profileId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (error) return { mode: "error", error, snapshot: snap, stockQty };
  return { mode: "pending_approval", error: null, snapshot: snap, stockQty };
}
