import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dollarsToCents, isBookingPaid } from "@/lib/money";
import { quoteBookingCode, recordRedemption, publicCode } from "@/lib/discounts";
import { applyCheckoutPoints } from "@/lib/pawPointsCheckout";
import { quoteBookingCustomerTotal } from "@/lib/pawServiceFee";

export const dynamic = "force-dynamic";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  return (new Date(startsAtISO).getTime() - Date.now()) / (1000 * 60 * 60);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { booking_id, payment_method = "card", promo_code } = body;
    const requestedPoints = Math.floor(Number(body.paw_points ?? body.points ?? 0) || 0);
    if (!booking_id || !["card", "etransfer", "later"].includes(payment_method)) {
      return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, payment_status, payment_received, sitter_id, service_type, estimated_total, booking_slots(starts_at)")
      .eq("id", booking_id)
      .eq("customer_id", user.id)
      .single();
    if (!booking || booking.status !== "accepted" || !booking.estimated_total) {
      return NextResponse.json({ error: "Booking not ready for payment." }, { status: 400 });
    }
    if (isBookingPaid(booking)) return NextResponse.json({ error: "This booking is already paid." }, { status: 400 });
    const hours = hoursUntilUTC((booking.booking_slots || [])[0]?.starts_at);
    if (hours !== null && hours < 48) {
      return NextResponse.json({ error: "Payment must be made at least 48 hours before the booking starts." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: settings } = await admin.from("sitter_payments").select("stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled").limit(1).maybeSingle();
    const enabled = {
      card: settings?.card_enabled ?? settings?.stripe_enabled ?? false,
      etransfer: settings?.etransfer_enabled ?? true,
      later: settings?.pay_later_enabled ?? true,
    };
    if (!enabled[payment_method]) return NextResponse.json({ error: "This payment method is currently unavailable." }, { status: 403 });

    if (payment_method !== "card") {
      const { error } = await supabase.from("bookings").update({ payment_method, payment_status: "pending", updated_at: new Date().toISOString() }).eq("id", booking_id).eq("customer_id", user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, method: payment_method });
    }
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });

    let discountCents = 0;
    let fundedByPlatform = false;
    let codeRow = null;
    let breakdown = [];
    if (promo_code) {
      const quoteResult = await quoteBookingCode(promo_code, user, booking);
      if (!quoteResult.ok) return NextResponse.json({ error: quoteResult.reason }, { status: 400 });
      discountCents = quoteResult.quote.discountCents;
      fundedByPlatform = quoteResult.quote.fundedByPlatform;
      codeRow = quoteResult.code;
      breakdown = quoteResult.quote.breakdown || [];
    }

    const subtotalCents = dollarsToCents(booking.estimated_total);
    if (subtotalCents < 50) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    const preFee = quoteBookingCustomerTotal({ subtotalCents, promoCents: discountCents, pointsCents: 0 });
    const points = await applyCheckoutPoints({
      userId: user.id,
      bookingId: booking_id,
      merchandiseCents: subtotalCents + preFee.feeCents,
      requestedPoints,
      maxDiscountCents: preFee.feeCents,
    });
    const quoted = quoteBookingCustomerTotal({
      subtotalCents,
      promoCents: discountCents,
      pointsCents: points.cents || 0,
    });
    if (requestedPoints >= 100 && !(points.cents > 0)) {
      return NextResponse.json({ error: points.reason || `Could not apply Paw Points on this booking (min 100, max ${points.capPoints || 0} pts against the Paw Service Fee).` }, { status: 400 });
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000").replace(/\/$/, "");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { data: connect } = await admin.from("stripe_connect_accounts").select("stripe_account_id, payouts_enabled").eq("sitter_id", booking.sitter_id).maybeSingle();
    const sessionPayload = {
      mode: "payment",
      customer_email: user.email || undefined,
      success_url: `${origin}/account?paid=1&booking=${booking_id}`,
      cancel_url: `${origin}/account?canceled=1&booking=${booking_id}`,
      metadata: {
        user_id: user.id,
        booking_id: String(booking_id),
        sitter_id: String(booking.sitter_id || ""),
        service_type: booking.service_type || "",
        discount_cents: String(discountCents),
        paw_points: String(points.points || 0),
        paw_points_cents: String(points.cents || 0),
        service_fee_cents: String(quoted.feeCents),
        sitter_payout_cents: String(quoted.sitterPayoutCents),
        funded_by_platform: fundedByPlatform ? "1" : "0",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: quoted.subtotalCents,
            product_data: { name: booking.service_type === "house_sit" ? "House sit" : "Sitter service" },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: Math.max(0, quoted.feeAfterDiscountCents),
            product_data: {
              name: "Paw Service Fee (10%)",
              description: points.points ? `${points.points} Paw Points applied to this fee` : "Platform fee — not paid to the sitter",
            },
          },
        },
      ].filter((line) => line.price_data.unit_amount > 0),
    };
    if (connect?.stripe_account_id && quoted.applicationFeeCents >= 0 && quoted.sitterPayoutCents >= 50) {
      sessionPayload.payment_intent_data = {
        transfer_data: { destination: connect.stripe_account_id },
        application_fee_amount: quoted.applicationFeeCents,
      };
    }
    const session = await stripe.checkout.sessions.create(sessionPayload);

    const stamp = {
      payment_method: "card",
      payment_status: "pending",
      discount_code: codeRow?.code || null,
      discount_code_id: codeRow?.id || null,
      discount_cents: discountCents,
      discount_funded_by: fundedByPlatform ? "platform" : codeRow ? "vendor" : null,
      paw_points_redeemed: points.points || 0,
      paw_points_cents: points.cents || 0,
      platform_fee_cents: quoted.applicationFeeCents,
      sitter_payout_cents: quoted.sitterPayoutCents,
      updated_at: new Date().toISOString(),
    };
    const { error: stampErr } = await supabase.from("bookings").update(stamp).eq("id", booking_id);
    if (stampErr) throw stampErr;
    if (codeRow && discountCents) {
      await recordRedemption({ code: codeRow, userId: user.id, bookingId: booking_id, discountCents, fundedByPlatform, breakdown });
    }
    return NextResponse.json({
      url: session.url,
      amount_cents: quoted.customerPayCents,
      fee_cents: quoted.feeCents,
      paw_points: points.points,
      code: codeRow ? publicCode(codeRow, { discountCents, breakdown }) : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start card checkout" }, { status: 500 });
  }
}
