import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBookingPaid } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function markBookingPaid(admin, bookingId, paymentIntent) {
  if (!bookingId) return;
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
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  const stripe = new Stripe(key);
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.metadata?.booking_id && (session.payment_status === "paid" || event.type === "checkout.session.completed")) {
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent || null;
        await markBookingPaid(admin, session.metadata.booking_id, pi);
      }
    }
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      if (pi.metadata?.booking_id) await markBookingPaid(admin, pi.metadata.booking_id, pi.id);
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Webhook failed" }, { status: 500 });
  }
}
