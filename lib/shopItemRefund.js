import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { onShopOrderRefunded } from "@/lib/pawPointsHooks";
import { clawbackShopItemRefundPoints } from "@/lib/shopItemPointAwards";

const REFUND_DAYS = 7;

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function remainingQty(item) {
  return Math.max(0, Math.floor(Number(item.qty || 0) - Number(item.refunded_qty || 0)));
}

function itemRemainingCents(item) {
  return Math.max(0, Math.floor(Number(item.price_cents || 0) * remainingQty(item)));
}

export function refundWindowEnd(order) {
  const ends = [];
  if (order?.return_window_ends_at) {
    const d = new Date(order.return_window_ends_at);
    if (!Number.isNaN(d.getTime())) ends.push(d.getTime());
  }
  if (order?.delivered_at) {
    const d = new Date(order.delivered_at);
    if (!Number.isNaN(d.getTime())) ends.push(d.getTime() + REFUND_DAYS * 24 * 60 * 60 * 1000);
  }
  if (!ends.length) return null;
  return new Date(Math.min(...ends));
}

export function canRefundDeliveredItem(order, item, now = new Date()) {
  if (!order || !item) return false;
  if (remainingQty(item) <= 0) return false;
  if ((item.refund_status || "none") === "refunded") return false;
  const delivered = order.status === "delivered" || !!order.delivered_at;
  if (!delivered) return true;
  const end = refundWindowEnd(order);
  if (!end || Number.isNaN(end.getTime())) return false;
  return now.getTime() < end.getTime();
}

async function paymentIntentId(client, order) {
  if (order.stripe_payment_intent) return order.stripe_payment_intent;
  if (!order.stripe_session_id) return null;
  const session = await client.checkout.sessions.retrieve(order.stripe_session_id);
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
}

async function refundStripe(order, amount, metadata) {
  if (amount <= 0) return { id: null, method: "none" };
  const client = stripeClient();
  const pi = await paymentIntentId(client, order);
  if (!pi) throw new Error("This order has no Stripe payment to refund.");
  const payload = { payment_intent: pi, amount };
  if (metadata) payload.metadata = metadata;
  try {
    const refund = await client.refunds.create({
      ...payload,
      refund_application_fee: true,
      reverse_transfer: true,
    });
    return { id: refund.id, method: "refund_with_fee_and_transfer" };
  } catch (err) {
    const refund = await client.refunds.create(payload);
    return { id: refund.id, method: "refund_only", warning: err.message };
  }
}

async function assertSeller(admin, order, sellerUserId) {
  const { data: shop } = await admin.from("shop_shops").select("id, owner_profile_id").eq("id", order.seller_shop_id).maybeSingle();
  if (!shop || shop.owner_profile_id !== sellerUserId) throw new Error("You can refund only your own shop orders.");
}

export async function applyShopItemRefund({ orderItemId, sellerUserId, qty }) {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("id, order_id, qty, price_cents, refund_status, refunded_qty, refund_cents, refunded_points, product:shop_products(name)")
    .eq("id", orderItemId)
    .maybeSingle();
  if (!item) throw new Error("Order item not found.");

  const { data: order } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, user_id, status, payment_status, stripe_session_id, stripe_payment_intent, refund_status, delivered_at, return_window_ends_at")
    .eq("id", item.order_id)
    .maybeSingle();
  if (!order) throw new Error("Order not found.");
  await assertSeller(admin, order, sellerUserId);
  if (order.status === "declined") throw new Error("This item cannot be refunded.");
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    throw new Error("Only paid orders can be refunded.");
  }
  if (!canRefundDeliveredItem(order, item)) {
    throw new Error("This item cannot be refunded.");
  }

  const left = remainingQty(item);
  const refundQty = Math.max(1, Math.min(left, Math.floor(Number(qty || left))));
  const amount = Math.max(0, Math.floor(Number(item.price_cents || 0) * refundQty));
  if (amount <= 0) throw new Error("This item has no refundable amount.");

  const prevQty = Math.max(0, Math.floor(Number(item.refunded_qty || 0)));
  const sourceKey = `shop_item_refund:${item.id}:${prevQty + refundQty}`;
  const { data: existingEvent } = await admin
    .from("shop_order_item_refund_events")
    .select("id, stripe_refund_id, clawed_points")
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (existingEvent?.stripe_refund_id) {
    return { ok: true, skipped: "already_refunded", amount, qty: refundQty };
  }
  if (!existingEvent) {
    const { error: eventErr } = await admin.from("shop_order_item_refund_events").insert({
      order_id: order.id,
      order_item_id: item.id,
      refund_qty: refundQty,
      refund_cents: amount,
      clawed_points: 0,
      source: "seller_item_refund",
      source_key: sourceKey,
    });
    if (eventErr && !/duplicate|unique/i.test(eventErr.message || "")) throw eventErr;
  }

  let stripeResult;
  try {
    stripeResult = await refundStripe(order, amount, {
      paw_sitter_refund: "seller_item",
      order_id: order.id,
      order_item_id: item.id,
      refund_qty: String(refundQty),
      source_key: sourceKey,
    });
  } catch (err) {
    await admin.from("shop_order_item_refund_events").delete().eq("source_key", sourceKey).is("stripe_refund_id", null);
    throw err;
  }

  const now = new Date().toISOString();
  const nextQty = prevQty + refundQty;
  const nextCents = (item.refund_cents || 0) + amount;
  const fully = nextQty >= (item.qty || 0);
  const { error: itemErr } = await admin.from("shop_order_items").update({
    refunded_qty: nextQty,
    refund_cents: nextCents,
    refund_status: fully ? "refunded" : "pending",
    stripe_refund_id: stripeResult.id,
    refunded_at: now,
  }).eq("id", item.id);
  if (itemErr) throw itemErr;

  let clawed = { points: 0, ledgerId: null };
  try {
    clawed = await clawbackShopItemRefundPoints({
      orderId: order.id,
      orderItemId: item.id,
      userId: order.user_id,
      refundQty,
      previouslyRefundedQty: prevQty,
      sourceKey,
    });
  } catch (err) {
    console.error(err.message);
  }

  await admin.from("shop_order_item_refund_events").update({
    stripe_refund_id: stripeResult.id,
    clawed_points: clawed.points || 0,
    clawback_ledger_id: clawed.ledgerId || null,
  }).eq("source_key", sourceKey);

  const { data: items } = await admin.from("shop_order_items").select("id, qty, refunded_qty, refund_status").eq("order_id", order.id);
  const allRefunded = (items || []).every((row) => remainingQty(row) <= 0 || (row.refund_status || "none") === "refunded");
  const orderPatch = { refund_status: allRefunded ? "refunded" : "pending", updated_at: now };
  if (allRefunded) orderPatch.refunded_at = now;
  await admin.from("shop_orders").update(orderPatch).eq("id", order.id);

  return { ok: true, amount, qty: refundQty, clawed_points: clawed.points || 0, stripe: stripeResult, product_name: item.product?.name || "Item" };
}

export async function applyShopOrderDeclineRefund({ orderId, sellerUserId }) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, user_id, status, payment_status, stripe_session_id, stripe_payment_intent, refund_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Order not found.");
  await assertSeller(admin, order, sellerUserId);
  if ((order.refund_status || "none") === "refunded") return { ok: true, skipped: "already_refunded" };

  const { data: items } = await admin
    .from("shop_order_items")
    .select("id, qty, price_cents, refund_status, refunded_qty, refund_cents")
    .eq("order_id", order.id);
  const remainingCents = (items || []).reduce((sum, item) => sum + itemRemainingCents(item), 0);
  const paid = ["paid", "partially_refunded"].includes(order.payment_status);
  let stripeResult = { id: null, method: "unpaid" };
  if (paid && remainingCents > 0) {
    stripeResult = await refundStripe(order, remainingCents);
  } else if (!paid) {
    try { await onShopOrderRefunded(order.id, remainingCents); } catch (err) { console.error(err.message); }
  }

  const now = new Date().toISOString();
  for (const item of items || []) {
    const left = remainingQty(item);
    if (left <= 0) continue;
    await admin.from("shop_order_items").update({
      refunded_qty: (item.refunded_qty || 0) + left,
      refund_cents: (item.refund_cents || 0) + Math.floor(Number(item.price_cents || 0) * left),
      refund_status: "refunded",
      stripe_refund_id: stripeResult.id,
      refunded_at: now,
    }).eq("id", item.id);
  }
  await admin.from("shop_orders").update({
    refund_status: "refunded",
    refunded_at: now,
    updated_at: now,
  }).eq("id", order.id);
  return { ok: true, amount: remainingCents, stripe: stripeResult };
}
