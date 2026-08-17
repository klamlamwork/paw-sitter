import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveShippingScope, resolveShippingRate, fetchShopShippingSettings } from "@/lib/shopShipping";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to checkout" }, { status: 401 });

    const body = await request.json();
    const { address, selections } = body || {};
    if (!address || !selections) {
      return NextResponse.json({ error: "Missing address or selections" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const cartIdRes = await supabase.rpc("ensure_user_cart", { p_user_id: user.id });
    const cartId = cartIdRes.data || cartIdRes.error ? null : cartIdRes.data;

    const { data: cartItems, error: cartErr } = await supabase
      .from("shop_cart_items")
      .select("id, product_id, variant_id, shop_id, qty, price_cents, currency")
      .eq("cart_id", cartId);
    if (cartErr) throw cartErr;
    if (!cartItems?.length) return NextResponse.json({ error: "Cart empty" }, { status: 400 });

    const bySeller = new Map();
    for (const item of cartItems) {
      if (!item.shop_id) continue;
      if (!bySeller.has(item.shop_id)) bySeller.set(item.shop_id, []);
      bySeller.get(item.shop_id).push(item);
    }

    const quotes = [];
    let totalShippingCents = 0;

    for (const [shopId, items] of bySeller.entries()) {
      const method = selections[shopId] || "standard";
      const settings = await fetchShopShippingSettings(shopId);

      // Fallback defaults if no settings exist
      if (!settings) {
        const fallback = { cents: 0, label: "Standard · Free" };
        quotes.push({ shopId, method, ...fallback, blocked: false });
        continue;
      }

      const scopeResult = resolveShippingScope({
        address,
        shopProvince: settings.fulfillment_province,
        allowNational: settings.allow_national,
        nationalRegions: settings.national_regions || [],
        shipToUs: settings.ship_to_us,
        excludeRegions: settings.exclude_regions || [],
      });

      if (scopeResult.scope === "blocked") {
        quotes.push({ shopId, method, cents: 0, label: "Unavailable", blocked: true, reason: scopeResult.reason });
        continue;
      }

      const subtotalCents = items.reduce((s, i) => s + (i.price_cents || 0) * (i.qty || 1), 0);
      const rate = resolveShippingRate({ settings, method, scope: scopeResult.scope, subtotalCents });
      if (!rate) {
        quotes.push({ shopId, method, cents: 0, label: "Unavailable", blocked: true });
        continue;
      }
      quotes.push({ shopId, method, cents: rate.cents, label: rate.label || "Shipping", blocked: false });
      totalShippingCents += rate.cents;
    }

    return NextResponse.json({ quotes, totalShippingCents });
  } catch (err) {
    console.error("Shipping quote error:", err);
    return NextResponse.json({ error: err.message || "Could not quote shipping" }, { status: 500 });
  }
}
