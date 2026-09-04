import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPointConfig } from "@/lib/pawPoints";
import { allocateShopSettlements } from "@/lib/shopOrderSettlement";

async function sessionMeta(sessionId) {
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) return {};
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.metadata || {};
  } catch {
    return {};
  }
}

function cartTotal(values) {
  const nums = (values || []).map((n) => Math.max(0, Number(n) || 0));
  if (!nums.length) return 0;
  const same = nums.every((n) => n === nums[0]);
  return same ? nums[0] : nums.reduce((a, b) => a + b, 0);
}

export async function persistShopOrderSettlements(orderId) {
  if (!orderId) return null;
  const admin = createAdminClient();
  const { data: seed, error: seedErr } = await admin
    .from("shop_orders")
    .select("id, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (seedErr) throw seedErr;
  if (!seed) return null;

  let orderQuery = admin
    .from("shop_orders")
    .select("id, seller_shop_id, discount_cents, discount_funded_by, paw_points_redeemed, paw_points_cents, shipping_cents, stripe_session_id");
  const { data: orders, error: orderErr } = seed.stripe_session_id
    ? await orderQuery.eq("stripe_session_id", seed.stripe_session_id)
    : await orderQuery.eq("id", orderId);
  if (orderErr) throw orderErr;
  const orderList = orders || [];
  if (!orderList.length) return null;

  const { data: itemRows, error: itemErr } = await admin
    .from("shop_order_items")
    .select("id, order_id, qty, price_cents, product:shop_products(product_type)")
    .in("order_id", orderList.map((o) => o.id));
  if (itemErr) throw itemErr;

  const meta = await sessionMeta(seed.stripe_session_id);
  const discountCents = Number.isFinite(Number(meta.discount_cents))
    ? Math.max(0, Number(meta.discount_cents))
    : cartTotal(orderList.map((o) => o.discount_cents));
  const pointsRedeemed = Number.isFinite(Number(meta.paw_points))
    ? Math.max(0, Math.floor(Number(meta.paw_points)))
    : cartTotal(orderList.map((o) => o.paw_points_redeemed));
  const pointsRedeemedCents = Number.isFinite(Number(meta.paw_points_cents))
    ? Math.max(0, Number(meta.paw_points_cents))
    : cartTotal(orderList.map((o) => o.paw_points_cents));
  let sponsor = "none";
  if (meta.funded_by_platform === "1" || orderList.some((o) => o.discount_funded_by === "platform")) sponsor = "platform";
  else if (discountCents > 0) sponsor = "vendor";

  const { rates, settings } = await loadPointConfig();
  let commissionPct = 10;
  try {
    const { data: cfg } = await admin.from("platform_settings").select("shop_commission_pct").eq("id", 1).maybeSingle();
    if (cfg?.shop_commission_pct != null) commissionPct = Number(cfg.shop_commission_pct) || 10;
  } catch {
    commissionPct = 10;
  }

  const allocated = allocateShopSettlements({
    sellers: orderList.map((order) => ({
      orderId: order.id,
      sellerShopId: order.seller_shop_id,
      shippingCents: order.shipping_cents,
      items: (itemRows || [])
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          id: item.id,
          qty: item.qty,
          price_cents: item.price_cents,
          product_type: item.product?.product_type || "other",
        })),
    })),
    discountCents,
    discountSponsor: sponsor,
    pointsRedeemed,
    pointsRedeemedCents,
    commissionPct,
    rates,
    defaultEarnRate: settings.default_product_points_per_dollar,
  });

  const now = new Date().toISOString();
  for (const row of allocated.orders) {
    if (!row.order_id) continue;
    const { error: setErr } = await admin.from("shop_order_settlements").upsert({
      order_id: row.order_id,
      merchandise_cents: row.merchandise_cents,
      discount_cents: row.discount_cents,
      discount_sponsor: row.discount_sponsor,
      shipping_cents: row.shipping_cents,
      points_redeemed: row.points_redeemed,
      points_redeemed_cents: row.points_redeemed_cents,
      points_earned: row.points_earned,
      seller_escrow_cents: row.seller_escrow_cents,
      platform_escrow_cents: row.platform_escrow_cents,
      display_total_cents: row.display_total_cents,
      updated_at: now,
    }, { onConflict: "order_id" });
    if (setErr) throw setErr;
    const { error: orderUpErr } = await admin.from("shop_orders").update({
      discount_cents: row.discount_cents,
      discount_funded_by: row.discount_sponsor === "none" ? null : row.discount_sponsor === "platform" ? "platform" : "vendor",
      paw_points_redeemed: row.points_redeemed,
      paw_points_cents: row.points_redeemed_cents,
      updated_at: now,
    }).eq("id", row.order_id);
    if (orderUpErr) throw orderUpErr;
  }
  for (const row of allocated.items) {
    if (!row.order_item_id) continue;
    const { error: itemUpErr } = await admin.from("shop_order_item_settlements").upsert({
      order_id: row.order_id,
      order_item_id: row.order_item_id,
      qty: row.qty,
      merchandise_cents: row.merchandise_cents,
      discount_cents: row.discount_cents,
      discount_sponsor: row.discount_sponsor,
      points_redeemed: row.points_redeemed,
      points_redeemed_cents: row.points_redeemed_cents,
      points_earned: row.points_earned,
      seller_escrow_cents: row.seller_escrow_cents,
      platform_escrow_cents: row.platform_escrow_cents,
      updated_at: now,
    }, { onConflict: "order_item_id" });
    if (itemUpErr) throw itemUpErr;
  }
  return allocated;
}
