import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { onShopOrderRefunded } from "@/lib/pawPointsHooks";

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

async function refundStripe(order, amount) {
  if (amount <= 0) return { id: null, method: "none" };
  const client = stripeClient();
  const pi = await paymentIntentId(client, order);
  if (!pi) throw new Error("This order has no Stripe payment to refund.");
  try {
    const refund = await client.refunds.create({
      payment_intent: pi,
      amount,
      refund_application_fee: true,
      reverse_transfer: true,
    });
    return { id: refund.id, method: "refund_with_fee_and_transfer" };
  } catch (err) {
    const refund = await client.refunds.create({ payment_intent: pi, amount });
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
    .select("id, order_id, qty, price_cents, refund_status, refunded_qty, refund_cents, product:shop_products(name)")
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
  if (!canRefundDeliveredItem(order, item)) {
    throw new Error("This item cannot be refunded.");
  }

  const left = remainingQty(item);
  const refundQty = Math.max(1, Math.min(left, Math.floor(Number(qty || left))));
  const amount = Math.max(0, Math.floor(Number(item.price_cents || 0) * refundQty));
  if (amount <= 0) throw new Error("This item has no refundable amount.");
  const stripeResult = await refundStripe(order, amount);

  const now = new Date().toISOString();
  const nextQty = (item.refunded_qty || 0) + refundQty;
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

  const { data: items } = await admin.from("shop_order_items").select("id, qty, refunded_qty, refund_status").eq("order_id", order.id);
  const allRefunded = (items || []).every((row) => remainingQty(row) <= 0 || (row.refund_status || "none") === "refunded");
  const orderPatch = { refund_status: allRefunded ? "refunded" : "pending", updated_at: now };
  if (allRefunded) orderPatch.refunded_at = now;
  await admin.from("shop_orders").update(orderPatch).eq("id", order.id);

  return { ok: true, amount, qty: refundQty, stripe: stripeResult, product_name: item.product?.name || "Item" };
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
