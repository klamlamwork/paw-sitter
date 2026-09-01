import { normalizeTagIds } from "@/lib/shopTags";

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

/** Keep live brand/tags unless this save explicitly included them. */
export function mergeBrandTagsIntoSnapshot(snap, product = {}, form = {}) {
  const next = { ...(snap || {}) };
  const pending = product.pending_snapshot && typeof product.pending_snapshot === "object"
    ? product.pending_snapshot
    : {};

  if (form.brand_name != null) {
    next.brand_name = String(form.brand_name).trim() || null;
  } else if (!hasOwn(next, "brand_name")) {
    if (hasOwn(pending, "brand_name")) next.brand_name = pending.brand_name;
    else if (hasOwn(product, "brand_name")) next.brand_name = product.brand_name || null;
  }

  if (Array.isArray(form.tag_ids)) {
    next.tag_ids = normalizeTagIds(form.tag_ids);
  } else if (!Array.isArray(next.tag_ids)) {
    if (Array.isArray(pending.tag_ids)) next.tag_ids = normalizeTagIds(pending.tag_ids);
    else if (Array.isArray(product.tag_ids)) next.tag_ids = normalizeTagIds(product.tag_ids);
  }

  return next;
}

/** Fields to fold into applySnapshotToProduct's product update. Empty if snapshot has no brand. */
export function brandPatchFromSnapshot(snap) {
  if (!hasOwn(snap, "brand_name")) return {};
  return { brand_name: String(snap.brand_name || "").trim() || null };
}

export function tagRowsFromSnapshot(productId, snap) {
  if (!Array.isArray(snap?.tag_ids)) return null;
  return normalizeTagIds(snap.tag_ids).map((tag_id) => ({ product_id: productId, tag_id }));
}

/**
 * Write tags only. Brand must be applied in the same shop_products update that
 * clears has_pending_edit, or the Phase 2b-1 trigger will keep the live brand.
 * No-ops when the snapshot has no tag_ids, so current approvals stay unchanged.
 */
export async function applyProductTagsFromSnapshot(supabase, productId, snap) {
  const rows = tagRowsFromSnapshot(productId, snap);
  if (rows == null) return null;
  const { error: delErr } = await supabase.from("shop_product_tags").delete().eq("product_id", productId);
  if (delErr) return delErr;
  if (!rows.length) return null;
  const { error: insErr } = await supabase.from("shop_product_tags").insert(rows);
  return insErr || null;
}
