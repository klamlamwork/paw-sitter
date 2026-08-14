import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  const now = Date.now();
  const start = new Date(startsAtISO).getTime();
  return (start - now) / (1000 * 60 * 60);
}

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { booking_id } = body || {};

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to cancel." }, { status: 401 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, payment_status, payment_method, sitter_id, service_type, customer_id, estimated_total, stripe_payment_intent, platform_fee_cents, sitter_payout_cents, booking_slots(starts_at)")
      .eq("id", booking_id)
      .eq("customer_id", user.id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const firstSlot = (booking.booking_slots || [])[0];
    const startsAtISO = firstSlot?.starts_at;
    const hoursUntilStart = hoursUntilUTC(startsAtISO);

    const isLateCancel = hoursUntilStart !== null && hoursUntilStart < 48;
    const hasPayment = booking.payment_status === "authorized" || booking.payment_status === "paid";

    if (hasPayment && isLateCancel) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const pi = booking.stripe_payment_intent;
      if (!pi) {
        return NextResponse.json({ error: "No payment intent found." }, { status: 400 });
      }

      const totalCents = Math.round((Number(booking.estimated_total) || 0) * 100);
      const chargeCents = Math.round(totalCents * 0.5);
      const refundCents = totalCents - chargeCents;

      const captured = await stripe.paymentIntents.capture(pi, { amount_to_capture: chargeCents });
      if (!captured) {
        return NextResponse.json({ error: "Could not capture payment." }, { status: 500 });
      }

      if (refundCents > 0) {
        await stripe.refunds.create({ payment_intent: pi, amount: refundCents });
      }

      const { error: err } = await supabase
        .from("bookings")
        .update({
          status: "canceled",
          payment_status: "partially_refunded",
          captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking_id);

      if (err) throw err;

      return NextResponse.json({ canceled: true, charged_cents: chargeCents, refunded_cents: refundCents });
    }

    if (hasPayment && !isLateCancel) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const pi = booking.stripe_payment_intent;
      if (pi) {
        await stripe.paymentIntents.cancel(pi);
      }
    }

    const { error: err } = await supabase
      .from("bookings")
      .update({
        status: "canceled",
        payment_status: hasPayment ? "refunded" : "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (err) throw err;

    return NextResponse.json({ canceled: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not cancel booking" }, { status: 500 });
  }
}
