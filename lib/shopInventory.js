/** Product type → default inventory mode + batch sellability */

export const PRODUCT_TYPES = [
  { value: "food", label: "Food", inventoryMode: "batch_expiry" },
  { value: "treats", label: "Treats", inventoryMode: "batch_expiry" },
  { value: "treat", label: "Treat", inventoryMode: "batch_expiry" },
  { value: "supplements", label: "Supplements / aids", inventoryMode: "batch_expiry" },
  { value: "supplement", label: "Supplement", inventoryMode: "batch_expiry" },
  { value: "litter", label: "Litter", inventoryMode: "batch_expiry" },
  { value: "bowls", label: "Bowls", inventoryMode: "simple" },
  { value: "beds", label: "Beds", inventoryMode: "simple" },
  { value: "toys", label: "Toys", inventoryMode: "simple" },
  { value: "toy", label: "Toy", inventoryMode: "simple" },
  { value: "grooming", label: "Grooming", inventoryMode: "simple" },
  { value: "apparel", label: "Apparel", inventoryMode: "simple" },
  { value: "gear", label: "Gear", inventoryMode: "simple" },
  { value: "other", label: "Other", inventoryMode: "simple" },
];

export function defaultInventoryMode(productType) {
  const type = PRODUCT_TYPES.find((p) => p.value === productType);
  return type?.inventoryMode || "simple";
}

// Accept an inventory mode directly. Older callers may still pass a product type.
export function isBatchExpiryMode(modeOrProductType) {
  return modeOrProductType === "batch_expiry" || defaultInventoryMode(modeOrProductType) === "batch_expiry";
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function batchStatusFromExpiry(expiryDate, qty) {
  if (qty != null && qty <= 0) return "depleted";
  const days = daysUntil(expiryDate);
  if (days == null) return "active";
  if (days < 0) return "expired";
  if (days <= 14) return "near_expiry";
  return "active";
}

export function isSellableBatch(batch) {
  if (!batch) return false;
  const onHand = Number(batch.qty_on_hand || 0);
  const reserved = Number(batch.qty_reserved || 0);
  if (onHand - reserved <= 0) return false;
  if (["held", "depleted", "expired"].includes(batch.status)) return false;
  return !batch.expiry_date || daysUntil(batch.expiry_date) >= 0;
}

export function sellableQtyFromBatches(batches) {
  return (batches || []).reduce((total, batch) => {
    if (!isSellableBatch(batch)) return total;
    return total + Math.max(Number(batch.qty_on_hand || 0) - Number(batch.qty_reserved || 0), 0);
  }, 0);
}

import { createAdminClient } from "@/lib/supabase/admin";

export async function deductShopOrderStock(orderId) {
  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) throw new Error("Order not found");
  if (order.payment_status !== "paid") throw new Error("Only paid orders can deduct stock");

  const { data: existingMoves } = await admin
    .from("shop_order_stock_moves")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existingMoves?.length) return { ok: true, skipped: "already_deducted" };

  const { data: items, error: itemsErr } = await admin
    .from("shop_order_items")
    .select("id, product_id, variant_id, qty")
    .eq("order_id", orderId);
  if (itemsErr) throw itemsErr;

  for (const item of items || []) {
    let remaining = item.qty || 0;
    if (remaining <= 0) continue;

    let batchQuery = admin
      .from("shop_product_batches")
      .select("id, qty_on_hand, expiry_date, status, variant_id")
      .gt("qty_on_hand", 0)
      .not("status", "in", "(held,depleted,expired)")
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .limit(80);
    if (item.variant_id) batchQuery = batchQuery.eq("variant_id", item.variant_id);
    else batchQuery = batchQuery.eq("product_id", item.product_id);

    const { data: batches, error: batchErr } = await batchQuery;
    if (batchErr) throw batchErr;

    const sellable = (batches || []).filter((b) => !b.expiry_date || daysUntil(b.expiry_date) >= 0);
    for (const batch of sellable) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.qty_on_hand || 0);
      if (take <= 0) continue;
      const nextQty = (batch.qty_on_hand || 0) - take;
      const { error: updateErr } = await admin
        .from("shop_product_batches")
        .update({
          qty_on_hand: nextQty,
          status: nextQty <= 0 ? "depleted" : batch.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
      if (updateErr) throw updateErr;
      const { error: moveErr } = await admin.from("shop_order_stock_moves").insert({
        order_id: order.id,
        order_item_id: item.id,
        variant_id: item.variant_id || batch.variant_id || null,
        batch_id: batch.id,
        qty: take,
      });
      if (moveErr) throw moveErr;
      remaining -= take;
    }

    if (remaining > 0 && item.variant_id) {
      const { data: variant, error: varErr } = await admin
        .from("shop_product_variants")
        .select("id, stock_qty, track_stock, name")
        .eq("id", item.variant_id)
        .maybeSingle();
      if (varErr) throw varErr;
      if (variant && variant.track_stock !== false) {
        const onHand = variant.stock_qty || 0;
        if (onHand < remaining) {
          throw new Error(`Not enough stock for ${variant.name || item.variant_id}; short ${remaining - onHand}`);
        }
        const { error: stockErr } = await admin
          .from("shop_product_variants")
          .update({ stock_qty: onHand - remaining, updated_at: new Date().toISOString() })
          .eq("id", variant.id);
        if (stockErr) throw stockErr;
        const { error: moveErr } = await admin.from("shop_order_stock_moves").insert({
          order_id: order.id,
          order_item_id: item.id,
          variant_id: variant.id,
          batch_id: null,
          qty: remaining,
        });
        if (moveErr) throw moveErr;
        remaining = 0;
      }
    }

    if (remaining > 0) {
      throw new Error(`Insufficient stock for product ${item.product_id} (variant ${item.variant_id || "none"}); short ${remaining}`);
    }
  }

  return { ok: true };
}
