import { createAdminClient } from "@/lib/supabase/admin";

export const PRODUCT_TYPES = [
  { value: "food", label: "Food", inventoryMode: "batch_expiry" },
  { value: "treats", label: "Treats", inventoryMode: "batch_expiry" },
  { value: "supplements", label: "Supplements", inventoryMode: "batch_expiry" },
  { value: "litter", label: "Litter", inventoryMode: "batch_expiry" },
  { value: "bowls", label: "Bowls", inventoryMode: "simple" },
  { value: "beds", label: "Beds", inventoryMode: "simple" },
  { value: "toys", label: "Toys", inventoryMode: "simple" },
  { value: "grooming", label: "Grooming", inventoryMode: "simple" },
  { value: "apparel", label: "Apparel", inventoryMode: "simple" },
  { value: "other", label: "Other", inventoryMode: "simple" },
];

const TYPE_ALIASES = {
  treat: "treats",
  treats: "treats",
  supplement: "supplements",
  supplements: "supplements",
  toy: "toys",
  toys: "toys",
  gear: "other",
  bowl: "bowls",
  bed: "beds",
};

export function normalizeProductType(value) {
  const raw = String(value || "").trim().toLowerCase();
  const mapped = TYPE_ALIASES[raw] || raw || "other";
  return PRODUCT_TYPES.some((t) => t.value === mapped) ? mapped : "other";
}

export function defaultInventoryMode(productType) {
  const t = PRODUCT_TYPES.find((p) => p.value === normalizeProductType(productType));
  return t?.inventoryMode || "simple";
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function batchStatusFromExpiry(expiryDate, qty) {
  if (!expiryDate) return "active";
  const days = daysUntil(expiryDate);
  if (days == null) return "active";
  if (days < 0) return "expired";
  if (days <= 7) return "expiring_soon";
  if (qty <= 0) return "depleted";
  return "active";
}

export function isSellableBatch(batch) {
  if (!batch) return false;
  const onHand = batch.qty_on_hand || 0;
  const reserved = batch.qty_reserved || 0;
  if (onHand - reserved <= 0) return false;
  if (batch.status === "held" || batch.status === "depleted" || batch.status === "expired") return false;
  if (batch.expiry_date && daysUntil(batch.expiry_date) < 0) return false;
  return true;
}

export function sellableQtyFromBatches(batches) {
  return (batches || []).reduce((sum, b) => {
    if (!isSellableBatch(b)) return sum;
    return sum + Math.max((b.qty_on_hand || 0) - (b.qty_reserved || 0), 0);
  }, 0);
}

export function isBatchExpiryMode(productType) {
  return defaultInventoryMode(productType) === "batch_expiry";
}

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

  const { data: existingMoves } = await admin.from("shop_order_stock_moves").select("id").eq("order_id", orderId).limit(1);
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
