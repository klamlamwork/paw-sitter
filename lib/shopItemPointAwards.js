import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger, earnPointsForItems, loadPointConfig } from "@/lib/pawPoints";

export function allocateShopItemPointAwards({
  items,
  discountCents,
  pawPointsCents,
  rates,
  defaultRate,
}) {
  const rows = items || [];
  const merchandise = rows.reduce(
    (sum, item) => sum + (Number(item.price_cents) || 0) * (item.qty || 1),
    0
  );
  const cashNet = Math.max(0, merchandise - (Number(discountCents) || 0) - (Number(pawPointsCents) || 0));
  const share = merchandise > 0 ? cashNet / merchandise : 0;
  return rows.map((item) => {
    const qty = Math.max(0, Math.floor(Number(item.qty || 0)));
    const productType = item.product?.product_type || item.product_type || "other";
    const awardedNetCents = Math.floor((Number(item.price_cents) || 0) * (item.qty || 1) * share);
    const earnedPoints = earnPointsForItems(
      [{ product_type: productType, qty: 1, net_cents: awardedNetCents }],
      rates,
      defaultRate
    );
    return {
      order_item_id: item.id,
      qty,
      awarded_net_cents: awardedNetCents,
      earned_points: earnedPoints,
      product_type: productType,
    };
  });
}

export async function ensureShopOrderItemPointAwards(orderId) {
  if (!orderId) return [];
  const admin = createAdminClient();
  const { data: existing, error: existingErr } = await admin
    .from("shop_order_item_point_awards")
    .select("id, order_id, order_item_id, earned_points, awarded_net_cents, qty")
    .eq("order_id", orderId);
  if (existingErr) throw existingErr;

  const { data: order } = await admin
    .from("shop_orders")
    .select("id, user_id, discount_cents, paw_points_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return existing || [];

  const { data: items } = await admin
    .from("shop_order_items")
    .select("id, qty, price_cents, product:shop_products(product_type)")
    .eq("order_id", orderId);

  const have = new Set((existing || []).map((row) => row.order_item_id));
  const missing = (items || []).filter((item) => item.id && !have.has(item.id));
  if (!missing.length) return existing || [];

  const { rates, settings } = await loadPointConfig();
  const allocated = allocateShopItemPointAwards({
    items: items || [],
    discountCents: order.discount_cents,
    pawPointsCents: order.paw_points_cents,
    rates,
    defaultRate: settings.default_product_points_per_dollar,
  });

  const { data: ledger } = await admin
    .from("paw_point_ledger")
    .select("id")
    .eq("order_id", orderId)
    .eq("reason", "earn_order")
    .gt("delta", 0)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const toInsert = allocated
    .filter((row) => row.order_item_id && !have.has(row.order_item_id))
    .map((row) => ({
      order_id: order.id,
      order_item_id: row.order_item_id,
      user_id: order.user_id,
      earned_points: row.earned_points,
      awarded_net_cents: row.awarded_net_cents,
      product_type: row.product_type,
      qty: row.qty,
      pending_ledger_id: ledger?.id || null,
    }));
  if (!toInsert.length) return existing || [];

  const { data: inserted, error } = await admin
    .from("shop_order_item_point_awards")
    .insert(toInsert)
    .select("id, order_id, order_item_id, earned_points, awarded_net_cents, qty");
  if (error) throw error;
  return [...(existing || []), ...(inserted || [])];
}

export async function backfillMissingPaidShopOrderAwards({ limit = 200 } = {}) {
  const admin = createAdminClient();
  const { data: orders, error } = await admin
    .from("shop_orders")
    .select("id")
    .in("payment_status", ["paid", "partially_refunded", "refunded"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const results = [];
  for (const order of orders || []) {
    const rows = await ensureShopOrderItemPointAwards(order.id);
    results.push({ orderId: order.id, awards: (rows || []).length });
  }
  return results;
}

export function pointsForRefundQty(award, previouslyRefundedQty, refundQty) {
  const qty = Math.max(1, Math.floor(Number(award?.qty || 0)));
  const earned = Math.max(0, Math.floor(Number(award?.earned_points || 0)));
  const prev = Math.max(0, Math.floor(Number(previouslyRefundedQty || 0)));
  const take = Math.max(0, Math.floor(Number(refundQty || 0)));
  if (!take) return 0;
  const prevCap = Math.min(qty, prev);
  const afterCap = Math.min(qty, prev + take);
  return Math.max(0, Math.floor((earned * afterCap) / qty) - Math.floor((earned * prevCap) / qty));
}

export async function clawbackShopItemRefundPoints({
  orderId,
  orderItemId,
  userId,
  refundQty,
  previouslyRefundedQty,
  sourceKey,
}) {
  const admin = createAdminClient();
  await ensureShopOrderItemPointAwards(orderId);

  const { data: award } = await admin
    .from("shop_order_item_point_awards")
    .select("id, qty, earned_points")
    .eq("order_item_id", orderItemId)
    .maybeSingle();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("refunded_points")
    .eq("id", orderItemId)
    .maybeSingle();

  const alreadyPts = Math.max(0, Math.floor(Number(item?.refunded_points || 0)));
  const earned = Math.max(0, Math.floor(Number(award?.earned_points || 0)));
  let points = pointsForRefundQty(award || { qty: 1, earned_points: 0 }, previouslyRefundedQty, refundQty);
  points = Math.min(points, Math.max(0, earned - alreadyPts));

  const { data: earn } = await admin
    .from("paw_point_ledger")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("reason", "earn_order")
    .gt("delta", 0)
    .in("status", ["pending", "available"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let ledgerId = null;
  if (points > 0 && userId && earn) {
    const row = await appendLedger({
      user_id: userId,
      delta: -points,
      status: earn.status,
      reason: "clawback",
      source_key: sourceKey,
      order_id: orderId,
      order_item_id: orderItemId,
      lot_id: earn.id,
      remark: "Clawback after refund",
    });
    ledgerId = row?.id || null;
  }

  const { error } = await admin
    .from("shop_order_items")
    .update({ refunded_points: alreadyPts + points })
    .eq("id", orderItemId);
  if (error) throw error;
  return { points, ledgerId };
}
