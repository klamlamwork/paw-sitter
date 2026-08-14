import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    }

    const body = await request.json();
    const { booking_id } = body || {};

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, payment_status, sitter_id, service_type, customer_id, estimated_total, booking_slots(starts_at)")
      .eq("id", booking_id)
      .eq("customer_id", user.id)
      .single();

    if (!booking || booking.status !== "accepted" || !booking.estimated_total) {
      return NextResponse.json({ error: "Booking not ready for payment." }, { status: 400 });
    }

    const firstSlot = (booking.booking_slots || [])[0];
    const startsAt = firstSlot?.starts_at;
    if (!startsAt) {
      return NextResponse.json({ error: "No start time found." }, { status: 400 });
    }

    const nowUtc = Date.now();
    const startUtc = new Date(startsAt).getTime();
    const hoursUntilStart = (startUtc - nowUtc) / (1000 * 60 * 60);

    if (hoursUntilStart < 48) {
      return NextResponse.json({ error: "Payment must be made at least 48 hours before the booking starts." }, { status: 400 });
    }

    const totalCents = Math.round((Number(booking.estimated_total) || 0) * 100);
    if (totalCents < 50) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const platformFeePct = 10.0;
    const platformFeeCents = Math.round((totalCents * platformFeePct) / 100);
    const sitterPayoutCents = totalCents - platformFeeCents;

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
        application_fee_amount: platformFeeCents,
      },
      success_url: `${origin}/account?paid=1&booking=${booking_id}`,
      cancel_url: `${origin}/account?canceled=1&booking=${booking_id}`,
      metadata: {
        user_id: user.id,
        booking_id: String(booking_id),
        sitter_id: String(booking.sitter_id),
        service_type: booking.service_type || "",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: totalCents,
            product_data: {
              name: booking.service_type === "house_sit" ? "House sit" : "Drop-in visit",
              description: `Platform fee ${platformFeePct}%`,
            },
          },
        },
      ],
    });

    const { error: stampErr } = await supabase
      .from("bookings")
      .update({
        payment_method: "card",
        payment_status: "authorized",
        stripe_payment_intent: session.payment_intent,
        platform_fee_cents: platformFeeCents,
        sitter_payout_cents: sitterPayoutCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (stampErr) throw stampErr;

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start card checkout" }, { status: 500 });
  }
}
