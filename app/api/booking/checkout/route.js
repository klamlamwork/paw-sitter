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
    const { booking_id, sitter_id, service_type, total_cents, customer } = body || {};

    if (!booking_id || !sitter_id || !total_cents || total_cents < 50) {
      return NextResponse.json({ error: "Invalid booking data." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, payment_status, sitter_id, service_type, estimated_total")
      .eq("id", booking_id)
      .eq("customer_id", user.id)
      .single();

    if (!booking || String(booking.sitter_id) !== String(sitter_id)) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const platformFeePct = 10.0;
    const platformFeeCents = Math.round((total_cents * platformFeePct) / 100);
    const sitterPayoutCents = total_cents - platformFeeCents;

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
      customer_email: customer?.email || user.email || undefined,
      success_url: `${origin}/booking?paid=1&booking=${booking_id}`,
      cancel_url: `${origin}/booking?canceled=1&booking=${booking_id}`,
      metadata: {
        user_id: user.id,
        booking_id: String(booking_id),
        sitter_id: String(sitter_id),
        service_type: service_type || "",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: total_cents,
            product_data: {
              name: service_type === "house_sit" ? "House sit" : "Drop-in visit",
              description: `Sitter ${sitter_id} • Platform fee ${platformFeePct}%`,
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
