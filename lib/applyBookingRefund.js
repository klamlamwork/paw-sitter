import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteBookingRefund, toCents } from "@/lib/refundPolicy";

function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function refundStripe(booking, refundCents) {
  const pi = booking.stripe_payment_intent;
  if (!pi || refundCents <= 0) return { stripe_refund_id: null, method: "none" };
  if (booking.payment_method && booking.payment_method !== "card") {
    return { stripe_refund_id: null, method: "manual" };
  }
  const client = stripe();
  try {
    const refund = await client.refunds.create({ payment_intent: pi, amount: refundCents });
    return { stripe_refund_id: refund.id, method: "refund" };
  } catch (err) {
    const msg = String(err.message || "");
    if (msg.includes("uncaptured") || msg.includes("not been captured")) {
      const keep = Math.max(0, toCents(booking.estimated_total) - refundCents);
      if (keep <= 0) {
        await client.paymentIntents.cancel(pi);
        return { stripe_refund_id: null, method: "cancel_intent" };
      }
      await client.paymentIntents.capture(pi, { amount_to_capture: keep });
      return { stripe_refund_id: null, method: "partial_capture" };
    }
    throw err;
  }
}

async function updateEscrow(admin, booking, quote) {
  const { data: settings } = await admin.from("platform_settings").select("service_commission_pct").eq("id", 1).maybeSingle();
  const pct = Number(settings?.service_commission_pct ?? 10);
  const commission = Math.round((quote.retained_cents * pct) / 100);
  const net = Math.max(0, quote.retained_cents - commission);
  const status = quote.retained_cents <= 0 ? "refunded" : "escrow_pending";
  const { error } = await admin
    .from("escrow_entries")
    .update({
      gross_cents: quote.retained_cents,
      commission_pct: pct,
      commission_cents: commission,
      net_cents: net,
      status,
      notes: `Adjusted after ${quote.actor} cancel. Refund ${quote.refund_cents} cents.`,
      updated_at: new Date().toISOString(),
    })
    .eq("kind", "booking")
    .eq("ref_id", booking.id)
    .in("status", ["escrow_pending", "releasable"]);
  if (error && !String(error.message || "").includes("Could not find")) throw error;
}

export async function applyBookingRefund({ booking, actor, waiveRemaining = false, reason = "" }) {
  const quote = quoteBookingRefund(booking, { actor, waiveRemaining });
  const paid = ["paid", "authorized", "partially_refunded"].includes(booking.payment_status) || booking.payment_received;
  let stripeResult = { stripe_refund_id: null, method: "unpaid" };
  if (paid && quote.refund_cents > 0) {
    stripeResult = await refundStripe(booking, quote.refund_cents);
  }

  const admin = createAdminClient();
  const paymentStatus = !paid
    ? booking.payment_status || "pending"
    : quote.refund_cents <= 0
    ? booking.payment_status
    : quote.retained_cents <= 0
    ? "refunded"
    : "partially_refunded";

  const { error } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      payment_status: paymentStatus,
      cancel_actor: actor,
      cancel_reason: reason || quote.summary,
      refund_cents: quote.refund_cents,
      retained_cents: quote.retained_cents,
      sitter_waived: !!waiveRemaining,
      refund_breakdown: quote,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);
  if (error) throw error;

  await admin.from("booking_refunds").insert({
    booking_id: booking.id,
    actor,
    waived: !!waiveRemaining,
    refund_cents: quote.refund_cents,
    retained_cents: quote.retained_cents,
    stripe_refund_id: stripeResult.stripe_refund_id,
    breakdown: { ...quote, stripe: stripeResult },
  });

  if (paid) await updateEscrow(admin, booking, quote);
  return { quote, stripe: stripeResult, payment_status: paymentStatus };
}
