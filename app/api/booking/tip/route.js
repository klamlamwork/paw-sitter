import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canTipBooking } from "@/lib/tips";

export const dynamic = "force-dynamic";

const SELECT = "id, status, payment_status, payment_received, customer_id, sitter_id, sitters(display_name), booking_slots(starts_at)";

export async function GET(request) {
  try {
    const bookingId = new URL(request.url).searchParams.get("booking_id");
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401 });
    const { data: booking } = await supabase.from("bookings").select(SELECT).eq("id", bookingId).eq("customer_id", user.id).single();
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const { data: tips } = await supabase.from("booking_tips").select("id, amount_cents, currency, status, paid_at, created_at").eq("booking_id", bookingId).order("created_at", { ascending: false });
    return NextResponse.json({ can_tip: canTipBooking(booking), tips: tips || [], sitter_name: booking.sitters?.display_name || "your sitter" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load tips" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    const body = await request.json();
    const bookingId = body?.booking_id;
    const amountCents = Math.round(Number(body?.amount_cents) || 0);
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    if (amountCents < 100) return NextResponse.json({ error: "Minimum tip is $1.00." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to tip." }, { status: 401 });
    const { data: booking } = await supabase.from("bookings").select(SELECT).eq("id", bookingId).eq("customer_id", user.id).single();
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const allowed = canTipBooking(booking);
    if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: 400 });

    const admin = createAdminClient();
    const { data: tip, error: tipErr } = await admin.from("booking_tips").insert({
      booking_id: booking.id,
      customer_id: user.id,
      sitter_id: booking.sitter_id,
      amount_cents: amountCents,
      currency: "CAD",
      status: "pending",
    }).select("id").single();
    if (tipErr) throw tipErr;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin.replace(/\/$/, "")}/account?tipped=1`,
      cancel_url: `${origin.replace(/\/$/, "")}/account?tip_canceled=1`,
      metadata: { kind: "tip", tip_id: tip.id, booking_id: booking.id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: amountCents,
          product_data: { name: `Tip for ${booking.sitters?.display_name || "sitter"}` },
        },
      }],
    });
    await admin.from("booking_tips").update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq("id", tip.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start tip checkout" }, { status: 500 });
  }
}
