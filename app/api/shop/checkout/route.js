import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { ensureUserCart } from "@/lib/shopCart";
import { quoteShopCode, recordRedemption, publicCode } from "@/lib/discounts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    }
    const body = await request.json();
    const address = body?.address || {};
    const promoRaw = body?.promo_code;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

    const cartId = await ensureUserCart(supabase, user.id);
    const { data: cartItems, error: cartErr } = await supabase
      .from("shop_cart_items")
      .select("id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(name)")
      .eq("cart_id", cartId);
    if (cartErr) throw cartErr;
    if (!cartItems?.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

    let discountCents = 0;
    let fundedByPlatform = false;
    let codeRow = null;
    let breakdown = [];

    if (promoRaw) {
      const quoteResult = await quoteShopCode(promoRaw, user.id, cartItems);
      if (!quoteResult.ok) return NextResponse.json({ error: quoteResult.reason }, { status: 400 });
      discountCents = quoteResult.quote.discountCents;
      fundedByPlatform = quoteResult.quote.fundedByPlatform;
      codeRow = quoteResult.code;
      breakdown = quoteResult.quote.breakdown.map((r) => ({ vendorType: r.vendorType, vendorId: r.vendorId, gross: r.gross, discount: r.discount }));
    }

    const bySeller = new Map();
    for (const item of cartItems) {
      if (!item.shop_id) continue;
      if (!item.price_cents || item.price_cents < 50) {
        return NextResponse.json({ error: "Every card item needs a price of at least $0.50." }, { status: 400 });
      }
      if (!bySeller.has(item.shop_id)) bySeller.set(item.shop_id, []);
      bySeller.get(item.shop_id).push(item);
    }
    if (!bySeller.size) return NextResponse.json({ error: "No valid seller in cart." }, { status: 400 });

    const orderIds = [];
    for (const [sellerShopId, items] of bySeller.entries()) {
      const { data: order, error: orderErr } = await supabase
        .from("shop_orders")
        .insert({
          user_id: user.id,
          seller_shop_id: sellerShopId,
          status: "pending",
          payment_method: "card",
          payment_status: "pending",
          shipping_name: address.name || "",
          shipping_email: address.email || user.email || "",
          shipping_phone: address.phone || "",
          shipping_line1: address.line1 || "",
          shipping_line2: address.line2 || "",
          shipping_city: address.city || "",
          shipping_state: address.state || "",
          shipping_postal_code: address.postal_code || "",
          shipping_country: address.country || "Canada",
          discount_code: codeRow?.code || null,
          discount_code_id: codeRow?.id || null,
          discount_cents: discountCents,
          discount_funded_by: fundedByPlatform ? "platform" : (codeRow ? "vendor" : null),
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;
      orderIds.push(order.id);

      const { error: itemsErr } = await supabase.from("shop_order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          seller_shop_id: sellerShopId,
          qty: i.qty,
          price_cents: i.price_cents,
          currency: i.currency || "CAD",
        }))
      );
      if (itemsErr) throw itemsErr;
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000").replace(/\/$/, "");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: address.email || user.email || undefined,
      success_url: `${origin}/shop/orders?placed=1&paid=1`,
      cancel_url: `${origin}/shop/checkout?canceled=1`,
      metadata: {
        user_id: user.id,
        order_ids: orderIds.join(","),
        discount_cents: String(discountCents),
        funded_by_platform: fundedByPlatform ? "1" : "0",
      },
      line_items: cartItems.map((item) => ({
        quantity: item.qty || 1,
        price_data: {
          currency: (item.currency || "CAD").toLowerCase(),
          unit_amount: item.price_cents,
          product_data: { name: item.product?.name || "Shop item" },
        },
      })),
    });

    const { error: stampErr } = await supabase
      .from("shop_orders")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .in("id", orderIds);
    if (stampErr) throw stampErr;

    await supabase.from("shop_cart_items").delete().eq("cart_id", cartId);

    if (codeRow && discountCents) {
      await recordRedemption({
        code: codeRow,
        userId: user.id,
        orderId: orderIds[0],
        discountCents,
        fundedByPlatform,
        breakdown,
      });
    }

    return NextResponse.json({ url: session.url, discount_cents: discountCents, code: codeRow ? publicCode(codeRow, { discountCents, breakdown }) : null });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start card checkout" }, { status: 500 });
  }
}
