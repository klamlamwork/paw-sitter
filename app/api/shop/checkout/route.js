import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { ensureUserCart } from "@/lib/shopCart";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    }

    const body = await request.json();
    const address = body?.address || {};
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });

    const cartId = await ensureUserCart(supabase, user.id);
    const { data: cartItems, error: cartErr } = await supabase
      .from("shop_cart_items")
      .select("id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(name)")
      .eq("cart_id", cartId);
    if (cartErr) throw cartErr;
    if (!cartItems?.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

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

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: address.email || user.email || undefined,
      success_url: `${origin}/shop/orders?placed=1&paid=1`,
      cancel_url: `${origin}/shop/checkout?canceled=1`,
      metadata: {
        user_id: user.id,
        order_ids: orderIds.join(","),
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start card checkout" }, { status: 500 });
  }
}
