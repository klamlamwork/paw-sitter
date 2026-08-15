import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  const now = Date.now();
  const start = new Date(startsAtISO).getTime();
  return (start - now) / (1000 * 60 * 60);
}

function toCents(amount) {
  const n = Number(amount) || 0;
  if (Number.isInteger(n) && n >= 50) return n;
  return Math.round(n * 100);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { booking_id, payment_method = "card" } = body || {};

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
    const startsAtISO = firstSlot?.starts_at;
    const hoursUntilStart = hoursUntilUTC(startsAtISO);
    if (hoursUntilStart !== null && hoursUntilStart < 48) {
      return NextResponse.json({ error: "Payment must be made at least 48 hours before the booking starts." }, { status: 400 });
    }

    if (payment_method === "etransfer" || payment_method === "later") {
      const { error } = await supabase
        .from("bookings")
        .update({
          payment_method,
          payment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking_id)
        .eq("customer_id", user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, method: payment_method });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    }

    const totalCents = toCents(booking.estimated_total);
    if (totalCents < 50) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
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
              name: booking.service_type === "house_sit" ? "House sit" : "Sitter booking",
            },
          },
        },
      ],
    });

    const { error: stampErr } = await supabase
      .from("bookings")
      .update({
        payment_method: "card",
        payment_status: "pending",
        stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);
    if (stampErr) throw stampErr;

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start card checkout" }, { status: 500 });
  }
}
