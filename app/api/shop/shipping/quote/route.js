import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserCart } from "@/lib/shopCart";
import {
  defaultShippingSettings,
  resolveShippingRate,
  resolveShippingScope,
} from "@/lib/shopShipping";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const address = body?.address || {};
    const selections = body?.selections || {};
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to checkout" }, { status: 401 });

    const cartId = await ensureUserCart(supabase, user.id);
    const { data: cartItems, error: cartErr } = await supabase
      .from("shop_cart_items")
      .select("id, product_id, variant_id, shop_id, qty, price_cents, currency")
      .eq("cart_id", cartId);
    if (cartErr) throw cartErr;
    if (!cartItems?.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

    const shopIds = [...new Set(cartItems.map((i) => i.shop_id).filter(Boolean))];
    const { data: settingRows } = await supabase.from("shop_shipping_settings").select("*").in("shop_id", shopIds);
    const settingsByShop = Object.fromEntries((settingRows || []).map((row) => [row.shop_id, row]));

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
      const settings = settingsByShop[shopId] || defaultShippingSettings();
      const scopeResult = resolveShippingScope({
        address,
        shopProvince: settings.fulfillment_province,
        allowNational: settings.allow_national !== false,
        nationalRegions: settings.national_regions || [],
        shipToUs: !!settings.ship_to_us,
        excludeRegions: settings.exclude_regions || [],
      });
      if (scopeResult.scope === "blocked") {
        quotes.push({ shopId, method, cents: 0, label: "Unavailable", blocked: true, reason: scopeResult.reason });
        continue;
      }
      const subtotalCents = items.reduce((sum, item) => sum + (item.price_cents || 0) * (item.qty || 1), 0);
      const rate = resolveShippingRate({ settings, method, scope: scopeResult.scope, subtotalCents });
      if (!rate) {
        quotes.push({ shopId, method, cents: 0, label: "Unavailable", blocked: true, reason: "This shop does not offer that method." });
        continue;
      }
      quotes.push({ shopId, method, cents: rate.cents, label: rate.label, blocked: false });
      totalShippingCents += rate.cents;
    }

    return NextResponse.json({ quotes, totalShippingCents });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not quote shipping" }, { status: 500 });
  }
}
