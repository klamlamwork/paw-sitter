import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { computeCartTotals, money } from "@/lib/discounts";

export const dynamic = "force-dynamic";

const key = process.env.STRIPE_SECRET_KEY;
const stripe = key ? new Stripe(key) : null;

export async function POST(request) {
  try {
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to checkout" }, { status: 401 });

    const body = await request.json();
    const { items = [], discount_code = "" } = body;
    if (!items.length) return NextResponse.json({ error: "Cart empty" }, { status: 400 });

    const supabase = await createClient();
    const admin = createAdminClient();

    // Resolve products/variants and compute totals (post‑discount)
    const resolved = [];
    for (const it of items) {
      const { data: product } = await supabase
        .from("shop_products")
        .select("id, primary_shop_id, brand_shop_id, price_cents, currency, hide_price")
        .eq("id", it.product_id)
        .maybeSingle();
      if (!product) continue;
      let variant = null;
      if (it.variant_id) {
        const { data: v } = await supabase
          .from("shop_product_variants")
          .select("id, price_cents, is_active")
          .eq("id", it.variant_id)
          .maybeSingle();
        variant = v;
      }
      if (variant && !variant.is_active) continue;
      const baseCents = variant?.price_cents ?? product.price_cents ?? 0;
      resolved.push({
        product_id: product.id,
        variant_id: it.variant_id || null,
        qty: Math.max(1, it.qty || 1),
        unit_cents: baseCents,
        currency: product.currency || "CAD",
        seller_shop_id: product.primary_shop_id || product.brand_shop_id,
      });
    }

    if (!resolved.length) return NextResponse.json({ error: "Items unavailable" }, { status: 400 });

    const { subtotalCents, discountCents, totalCents, discountObj } = computeCartTotals(resolved, discount_code);
    if (totalCents <= 0) return NextResponse.json({ error: "Invalid total" }, { status: 400 });

    // Group by seller and create one order per seller, all linked to same Stripe session
    const bySeller = {};
    for (const r of resolved) {
      const key = r.seller_shop_id || "unknown";
      if (!bySeller[key]) bySeller[key] = [];
      bySeller[key].push(r);
    }

    const lineItems = resolved.map((r) => ({
      price_data: {
        currency: r.currency,
        product_data: { name: `Order item ${r.product_id}` },
        unit_amount: r.unit_cents,
      },
      quantity: r.qty,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      currency: resolved[0].currency.toLowerCase(),
      metadata: {
        profile_id: profile.id,
        discount_code: discount_code || "",
        discount_cents: String(discountCents),
        funded_by_platform: discountObj?.fundedByPlatform ? "1" : "0",
      },
      success_url: `${request.headers.get("origin")}/shop/orders?placed=1&paid=1`,
      cancel_url: `${request.headers.get("origin")}/shop/cart`,
    });

    const orderIds = [];
    for (const [sellerShopId, sellerItems] of Object.entries(bySeller)) {
      const sellerSubtotal = sellerItems.reduce((s, r) => s + r.unit_cents * r.qty, 0);
      const sellerDiscount = discountCents > 0
        ? Math.min(sellerSubtotal, Math.round((sellerSubtotal / subtotalCents) * discountCents))
        : 0;

      const { data: order, error: orderErr } = await admin
        .from("shop_orders")
        .insert({
          user_id: profile.id,
          seller_shop_id: sellerShopId,
          status: "pending",
          payment_status: "pending",
          payment_method: "card",
          stripe_session_id: session.id,
          discount_cents: sellerDiscount,
          discount_code: discount_code || null,
          discount_funded_by: discountObj?.fundedByPlatform ? "platform" : discountCents ? "vendor" : null,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;
      orderIds.push(order.id);

      const orderItems = sellerItems.map((r) => ({
        order_id: order.id,
        product_id: r.product_id,
        variant_id: r.variant_id,
        qty: r.qty,
        price_cents: r.unit_cents,
        currency: r.currency,
      }));
      const { error: itemsErr } = await admin.from("shop_order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;
    }

    await stripe.checkout.sessions.update(session.id, {
      metadata: { order_ids: orderIds.join(",") },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url, total: money(totalCents) });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: err.message || "Checkout failed" }, { status: 500 });
  }
}
