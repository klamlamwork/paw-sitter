import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";
import { clawbackShopItemRefundPoints } from "@/lib/shopItemPointAwards";

const REFUND_DAYS = 7;

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function remainingQty(item) {
  return Math.max(0, Math.floor(Number(item.qty || 0) - Number(item.refunded_qty || 0)));
}

function qtyShare(total, lineQty, prevQty, take) {
  const qty = Math.max(1, Math.floor(Number(lineQty) || 0));
  const prev = Math.max(0, Math.floor(Number(prevQty) || 0));
  const n = Math.max(0, Math.floor(Number(take) || 0));
  const earned = Math.max(0, Math.floor(Number(total) || 0));
  return Math.max(0, Math.floor((earned * Math.min(qty, prev + n)) / qty) - Math.floor((earned * Math.min(qty, prev)) / qty));
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

async function returnRedeemedPoints({ userId, orderId, orderItemId, points }) {
  const qty = Math.max(0, Math.floor(Number(points) || 0));
  if (!qty || !userId) return null;
  return appendLedger({
    user_id: userId,
    delta: qty,
    status: "available",
    reason: "admin_adjust",
    order_id: orderId,
    order_item_id: orderItemId,
    remark: "Paw Points returned after refund",
  });
}

async function clawEarnedPoints({ userId, orderId, orderItemId, points, sourceKey, earnStatus }) {
  const qty = Math.max(0, Math.floor(Number(points) || 0));
  if (!qty || !userId) return null;
  return appendLedger({
    user_id: userId,
    delta: -qty,
    status: earnStatus || "pending",
    reason: "clawback",
    source_key: sourceKey || null,
    order_id: orderId,
    order_item_id: orderItemId,
    remark: "Clawback after refund",
  });
}

async function reduceEscrow(admin, orderId, sellerCents, platformCents) {
  const seller = Math.max(0, Math.floor(Number(sellerCents) || 0));
  const platform = Math.max(0, Math.floor(Number(platformCents) || 0));
  if (!seller && !platform) return;
  const { data: row } = await admin
    .from("escrow_entries")
    .select("id, net_cents, commission_cents, status")
    .eq("kind", "shop_order")
    .eq("ref_id", orderId)
    .in("status", ["escrow_pending", "releasable"])
    .maybeSingle();
  if (!row) return;
  await admin.from("escrow_entries").update({
    net_cents: Math.max(0, (row.net_cents || 0) - seller),
    commission_cents: Math.max(0, (row.commission_cents || 0) - platform),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
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
  const prevQty = Math.max(0, Math.floor(Number(item.refunded_qty || 0)));

  const { data: itemSet } = await admin.from("shop_order_item_settlements").select("*").eq("order_item_id", item.id).maybeSingle();
  const { data: orderSet } = await admin.from("shop_order_settlements").select("*").eq("order_id", order.id).maybeSingle();

  let amount = Math.max(0, Math.floor(Number(item.price_cents || 0) * refundQty));
  let sellerEscrow = 0;
  let platformEscrow = 0;
  let returnPoints = 0;
  let clawPoints = 0;
  let shippingCents = 0;
  if (itemSet) {
    const merch = qtyShare(itemSet.merchandise_cents, itemSet.qty || item.qty, prevQty, refundQty);
    const discount = qtyShare(itemSet.discount_cents, itemSet.qty || item.qty, prevQty, refundQty);
    const pointCents = qtyShare(itemSet.points_redeemed_cents, itemSet.qty || item.qty, prevQty, refundQty);
    returnPoints = qtyShare(itemSet.points_redeemed, itemSet.qty || item.qty, prevQty, refundQty);
    clawPoints = qtyShare(itemSet.points_earned, itemSet.qty || item.qty, prevQty, refundQty);
    sellerEscrow = qtyShare(itemSet.seller_escrow_cents, itemSet.qty || item.qty, prevQty, refundQty);
    platformEscrow = qtyShare(itemSet.platform_escrow_cents, itemSet.qty || item.qty, prevQty, refundQty);
    amount = Math.max(0, merch - discount - pointCents);
  }

  const nextQty = prevQty + refundQty;
  const { data: allItems } = await admin.from("shop_order_items").select("id, qty, refunded_qty").eq("order_id", order.id);
  const remainingAfter = (allItems || []).reduce((sum, row) => {
    const used = row.id === item.id ? nextQty : (row.refunded_qty || 0);
    return sum + Math.max(0, (row.qty || 0) - used);
  }, 0);
  const unshipped = !order.delivered_at && order.status !== "shipped" && order.status !== "delivered";
  if (itemSet && orderSet && remainingAfter <= 0 && unshipped && !orderSet.shipping_refunded) {
    shippingCents = Math.max(0, Number(orderSet.shipping_cents) || 0);
    amount += shippingCents;
    const shipSeller = Math.round((shippingCents * 90) / 100);
    sellerEscrow += shipSeller;
    platformEscrow += Math.max(0, shippingCents - shipSeller);
  }
  if (amount <= 0) throw new Error("This item has no refundable amount.");

  const sourceKey = `shop_item_refund:${item.id}:${nextQty}`;
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

  let clawed = { points: clawPoints, ledgerId: null };
  try {
    if (itemSet) {
      const { data: earn } = await admin
        .from("paw_point_ledger")
        .select("id, status")
        .eq("order_id", order.id)
        .eq("reason", "earn_order")
        .gt("delta", 0)
        .in("status", ["pending", "available"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const clawRow = await clawEarnedPoints({
        userId: order.user_id,
        orderId: order.id,
        orderItemId: item.id,
        points: clawPoints,
        sourceKey,
        earnStatus: earn?.status || "pending",
      });
      clawed.ledgerId = clawRow?.id || null;
      await returnRedeemedPoints({
        userId: order.user_id,
        orderId: order.id,
        orderItemId: item.id,
        points: returnPoints,
      });
      await admin.from("shop_order_items").update({
        refunded_points: (item.refunded_points || 0) + clawPoints,
      }).eq("id", item.id);
    } else {
      clawed = await clawbackShopItemRefundPoints({
        orderId: order.id,
        orderItemId: item.id,
        userId: order.user_id,
        refundQty,
        previouslyRefundedQty: prevQty,
        sourceKey,
      });
    }
  } catch (err) {
    console.error(err.message);
  }

  try {
    await reduceEscrow(admin, order.id, sellerEscrow, platformEscrow);
    if (orderSet) {
      const patch = {
        seller_escrow_cents: Math.max(0, (orderSet.seller_escrow_cents || 0) - sellerEscrow),
        platform_escrow_cents: Math.max(0, (orderSet.platform_escrow_cents || 0) - platformEscrow),
        updated_at: now,
      };
      if (shippingCents) patch.shipping_refunded = true;
      await admin.from("shop_order_settlements").update(patch).eq("order_id", order.id);
    }
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

  return {
    ok: true,
    amount,
    qty: refundQty,
    shipping_cents: shippingCents,
    clawed_points: clawed.points || 0,
    returned_points: returnPoints,
    stripe: stripeResult,
    product_name: item.product?.name || "Item",
  };
}

export async function applyShopOrderDeclineRefund({ orderId, sellerUserId }) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, payment_status, refund_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Order not found.");
  await assertSeller(admin, order, sellerUserId);

  const { data: items } = await admin
    .from("shop_order_items")
    .select("id, qty, refunded_qty, refund_status")
    .eq("order_id", order.id);
  const remaining = (items || []).filter((item) => remainingQty(item) > 0 && (item.refund_status || "none") !== "refunded");
  if (!remaining.length) return { ok: true, skipped: "already_refunded" };
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    return { ok: true, skipped: "unpaid" };
  }

  const results = [];
  for (const item of remaining) {
    const result = await applyShopItemRefund({
      orderItemId: item.id,
      sellerUserId,
      qty: remainingQty(item),
    });
    results.push(result);
  }
  return { ok: true, items: results };
}
