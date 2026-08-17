import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordTipEscrow } from "@/lib/tips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function markBookingPaid(admin, bookingId, paymentIntent) {
  if (!bookingId) return;
  const { error } = await admin
    .from("bookings")
    .update({
      payment_method: "card",
      payment_status: "paid",
      payment_received: true,
      payment_received_at: new Date().toISOString(),
      stripe_payment_intent: paymentIntent || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
  if (error) throw error;
}

async function markTipPaid(admin, session) {
  const tipId = session?.metadata?.tip_id;
  if (!tipId && session?.metadata?.kind !== "tip") return false;
  const id = tipId || null;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent || null;
  const now = new Date().toISOString();
  let query = admin.from("booking_tips").update({
    status: "paid",
    paid_at: now,
    stripe_payment_intent: pi,
    updated_at: now,
  });
  query = id ? query.eq("id", id) : query.eq("stripe_session_id", session.id);
  const { data: tip, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  if (tip) await recordTipEscrow(tip);
  return true;
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

  try {
    const admin = createAdminClient();

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.metadata?.kind === "tip" || session.metadata?.tip_id) {
        await markTipPaid(admin, session);
      } else if (session.payment_status === "paid" || event.type === "checkout.session.completed") {
        const bookingId = session.metadata?.booking_id;
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent || null;
        await markBookingPaid(admin, bookingId, pi);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      if (pi.metadata?.kind === "tip" && pi.metadata?.tip_id) {
        const now = new Date().toISOString();
        const { data: tip, error } = await admin.from("booking_tips").update({
          status: "paid",
          paid_at: now,
          stripe_payment_intent: pi.id,
          updated_at: now,
        }).eq("id", pi.metadata.tip_id).select("*").maybeSingle();
        if (error) throw error;
        if (tip) await recordTipEscrow(tip);
      } else {
        await markBookingPaid(admin, pi.metadata?.booking_id, pi.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Webhook failed" }, { status: 500 });
  }
}
