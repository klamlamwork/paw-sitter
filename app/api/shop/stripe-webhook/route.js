import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const admin = createAdminClient();
    const discountCents = Number(session.metadata?.discount_cents) || 0;
    const fundedByPlatform = session.metadata?.funded_by_platform === "1";
    const { error } = await admin
      .from("shop_orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent || null,
        discount_cents: discountCents,
        discount_funded_by: fundedByPlatform ? "platform" : (discountCents ? "vendor" : null),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
