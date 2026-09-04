import { createAdminClient } from "@/lib/supabase/admin";
import {
  activatePendingFor,
  clawbackFor,
  earnPointsForItems,
  finalizeReserved,
  grantPendingEarn,
  loadPointConfig,
  pointsFromCents,
  reserveRedeem,
} from "@/lib/pawPoints";
import { quoteBookingCustomerTotal } from "@/lib/pawServiceFee";
import { dollarsToCents } from "@/lib/money";
import { onReferralBookingCompleted, onReferralShopDelivered, voidReferralForOrder } from "@/lib/referrals";
import { ensureShopOrderItemPointAwards } from "@/lib/shopItemPointAwards";
import { restorePrematureShopEarn } from "@/lib/shopOrderEarnHold";

async function postPaidRedemption({ userId, points, orderId, bookingId }) {
  const want = Math.max(0, Math.floor(Number(points) || 0));
  if (!want) return { points: 0, cents: 0 };
  const reserved = await reserveRedeem({ userId, points: want, orderId, bookingId });
  // finalizeReserved preserves the negative FIFO movement as the paid redemption.
  await finalizeReserved({ orderId, bookingId });
  return reserved;
}

export async function onShopOrderPaid(orderId) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, user_id, discount_cents, paw_points_cents, paw_points_redeemed")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  await postPaidRedemption({
    userId: order.user_id,
    points: order.paw_points_redeemed,
    orderId,
  });

  const { data: items } = await admin
    .from("shop_order_items")
    .select("qty, price_cents, product:shop_products(product_type)")
    .eq("order_id", orderId);
  const { rates, settings } = await loadPointConfig();
  const merchandise = (items || []).reduce((s, i) => s + (i.price_cents || 0) * (i.qty || 1), 0);
  const cashNet = Math.max(0, merchandise - (order.discount_cents || 0) - (order.paw_points_cents || 0));
  const share = merchandise > 0 ? cashNet / merchandise : 0;
  const earnItems = (items || []).map((i) => ({
    product_type: i.product?.product_type || "other",
    qty: 1,
    net_cents: Math.floor((i.price_cents || 0) * (i.qty || 1) * share),
  }));
  const points = earnPointsForItems(earnItems, rates, settings.default_product_points_per_dollar);
  await grantPendingEarn({
    userId: order.user_id,
    points,
    reason: "earn_order",
    sourceKey: "other",
    orderId,
    remark: "Earnings - Shop order",
  });
  try {
    await ensureShopOrderItemPointAwards(orderId);
  } catch (err) {
    console.error(err.message);
  }
}

export async function onShopOrderDelivered(orderId) {
  try { await restorePrematureShopEarn(orderId); } catch (e) { console.error(e.message); }
  try { await onReferralShopDelivered(orderId); } catch (e) { console.error(e.message); }
  return { held_until_return_window: true };
}

export async function onShopOrderRefunded(orderId, refundCents) {
  const admin = createAdminClient();
  try {
    const { data: tagged } = await admin
      .from("shop_order_item_refund_events")
      .select("id")
      .eq("order_id", orderId)
      .eq("source", "seller_item_refund")
      .limit(1);
    if ((tagged || []).length) return { skipped: "seller_item_refund" };
  } catch (err) {
    console.error(err.message);
  }
  const result = await clawbackFor({ orderId, refundCents });
  try { await voidReferralForOrder(orderId); } catch (e) { console.error(e.message); }
  return result;
}

export async function onBookingPaid(bookingId) {
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, estimated_total, discount_cents, paw_points_cents, paw_points_redeemed")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;

  await postPaidRedemption({
    userId: booking.customer_id,
    points: booking.paw_points_redeemed,
    bookingId,
  });

  const { rates, settings } = await loadPointConfig();
  const subtotal = dollarsToCents(booking.estimated_total);
  const quoted = quoteBookingCustomerTotal({
    subtotalCents: subtotal,
    promoCents: booking.discount_cents || 0,
    pointsCents: booking.paw_points_cents || 0,
  });
  const rate = rates.sitter_booking?.points_per_dollar ?? settings.booking_points_per_dollar ?? 5;
  const points = pointsFromCents(quoted.earnBaseCents, rate);
  await grantPendingEarn({
    userId: booking.customer_id,
    points,
    reason: "earn_booking",
    sourceKey: "sitter_booking",
    bookingId,
    remark: "Earnings - Service booking",
  });
}

export async function onBookingCompleted(bookingId) {
  const result = await activatePendingFor({ bookingId });
  try { await onReferralBookingCompleted(bookingId); } catch (e) { console.error(e.message); }
  return result;
}
