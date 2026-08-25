import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductShopOrderStock } from "@/lib/shopInventory";
import { onShopOrderPaid, onShopOrderRefunded, onBookingPaid } from "@/lib/pawPointsHooks";
import { clearUserShopCart, releaseReservedPoints } from "@/lib/pawPointsRelease";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function markBookingPaid(admin, bookingId, paymentIntent) {
  if (!bookingId) return false;
  const { error } = await admin.from("bookings").update({
    payment_method: "card",
    payment_status: "paid",
    payment_received: true,
    payment_received_at: new Date().toISOString(),
    stripe_payment_intent: paymentIntent || null,
    updated_at: new Date().toISOString(),
  }).eq("id", bookingId);
  if (error) throw error;
  try { await onBookingPaid(bookingId); } catch (e) { console.error(e.message); }
  return true;
}

async function releaseSessionPoints(session) {
  const userId = session.metadata?.user_id || null;
  const orderIds = String(session.metadata?.order_ids || "").split(",").filter(Boolean);
  const bookingId = session.metadata?.booking_id || null;
  if (bookingId) {
    await releaseReservedPoints({ userId, bookingId });
    return;
  }
  for (const orderId of orderIds) {
    await releaseReservedPoints({ userId, orderId });
  }
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(key);
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent || null;
    if (bookingId) {
      await markBookingPaid(admin, bookingId, pi);
      return NextResponse.json({ received: true, booking: bookingId });
    }

    const discountCents = Number(session.metadata?.discount_cents) || 0;
    const fundedByPlatform = session.metadata?.funded_by_platform === "1";
    const { data: paidOrders, error } = await admin
      .from("shop_orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: pi,
        discount_cents: discountCents,
        discount_funded_by: fundedByPlatform ? "platform" : discountCents ? "vendor" : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fromMeta = (session.metadata?.order_ids || "").split(",").filter(Boolean);
    const orderIds = [...new Set([...(paidOrders || []).map((o) => o.id), ...fromMeta])];
    for (const orderId of orderIds) {
      try { await deductShopOrderStock(orderId); } catch (e) { console.error(e.message); }
      try { await onShopOrderPaid(orderId); } catch (e) { console.error(e.message); }
    }
    try {
      await clearUserShopCart(admin, {
        cartId: session.metadata?.cart_id || null,
        userId: session.metadata?.user_id || null,
      });
    } catch (e) { console.error(e.message); }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    try { await releaseSessionPoints(event.data.object); } catch (e) { console.error(e.message); }
    return NextResponse.json({ received: true, released: true });
  }

  if (event.type === "charge.refunded" || event.type === "refund.created") {
    const obj = event.data.object;
    const pi = obj.payment_intent || obj.payment_intent_id;
    if (pi) {
      const { data: orders } = await admin.from("shop_orders").select("id").eq("stripe_payment_intent", pi);
      for (const o of orders || []) {
        try { await onShopOrderRefunded(o.id, obj.amount_refunded || obj.amount || 0); } catch (e) { console.error(e.message); }
      }
    }
  }

  return NextResponse.json({ received: true });
}
