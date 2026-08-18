import { createAdminClient } from "@/lib/supabase/admin";
import {
  activatePendingFor,
  clawbackFor,
  earnPointsForItems,
  finalizeReserved,
  grantPendingEarn,
  loadPointConfig,
} from "@/lib/pawPoints";

export async function onShopOrderPaid(orderId) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("shop_orders").select("id, user_id, discount_cents, paw_points_cents, shipping_cents").eq("id", orderId).maybeSingle();
  if (!order) return;
  await finalizeReserved({ orderId });
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
    remark: "Pending until delivered",
  });
}

export async function onShopOrderDelivered(orderId) {
  return activatePendingFor({ orderId });
}

export async function onShopOrderRefunded(orderId, refundCents) {
  return clawbackFor({ orderId, refundCents });
}

export async function onBookingCompleted(bookingId) {
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("id, customer_id, estimated_total, discount_cents, paw_points_cents").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  await finalizeReserved({ bookingId });
  const { rates, settings } = await loadPointConfig();
  const dollars = Number(booking.estimated_total) || 0;
  const netCents = Math.max(0, Math.round(dollars * 100) - (booking.discount_cents || 0) - (booking.paw_points_cents || 0));
  const rate = rates.sitter_booking?.points_per_dollar ?? settings.booking_points_per_dollar;
  const points = Math.floor((netCents / 100) * Number(rate || 5));
  await grantPendingEarn({
    userId: booking.customer_id,
    points,
    reason: "earn_booking",
    sourceKey: "sitter_booking",
    bookingId,
    remark: "Pending until booking completed",
  });
  await activatePendingFor({ bookingId });
}
