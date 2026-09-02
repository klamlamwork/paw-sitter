import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { onShopOrderRefunded } from "@/lib/pawPointsHooks";

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function itemCents(item) {
  return Math.max(0, Math.floor(Number(item.price_cents || 0) * Number(item.qty || 1)));
}

async function paymentIntentId(client, order) {
  if (order.stripe_payment_intent) return order.stripe_payment_intent;
  if (!order.stripe_session_id) return null;
  const session = await client.checkout.sessions.retrieve(order.stripe_session_id);
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
}

async function refundStripe(order, amount) {
  if (amount <= 0) return { id: null, method: "none" };
  const client = stripeClient();
  const pi = await paymentIntentId(client, order);
  if (!pi) throw new Error("This order has no Stripe payment to refund.");
  try {
    const refund = await client.refunds.create({
      payment_intent: pi,
      amount,
      refund_application_fee: true,
      reverse_transfer: true,
    });
    return { id: refund.id, method: "refund_with_fee_and_transfer" };
  } catch (err) {
    const refund = await client.refunds.create({ payment_intent: pi, amount });
    return { id: refund.id, method: "refund_only", warning: err.message };
  }
}

export async function applyShopItemRefund({ orderItemId, sellerUserId }) {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("id, order_id, qty, price_cents, refund_status, product:shop_products(name)")
    .eq("id", orderItemId)
    .maybeSingle();
  if (!item) throw new Error("Order item not found.");
  if ((item.refund_status || "none") === "refunded") return { ok: true, skipped: "already_refunded" };

  const { data: order } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, user_id, payment_status, stripe_session_id, stripe_payment_intent, refund_status")
    .eq("id", item.order_id)
    .maybeSingle();
  if (!order) throw new Error("Order not found.");

  const { data: shop } = await admin.from("shop_shops").select("id, owner_profile_id").eq("id", order.seller_shop_id).maybeSingle();
  if (!shop || shop.owner_profile_id !== sellerUserId) throw new Error("You can refund only your own shop orders.");
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    throw new Error("Only paid orders can be refunded.");
  }

  const amount = itemCents(item);
  if (amount <= 0) throw new Error("This item has no refundable amount.");
  const stripeResult = await refundStripe(order, amount);

  const now = new Date().toISOString();
  const { error: itemErr } = await admin.from("shop_order_items").update({
    refund_status: "refunded",
    refund_cents: amount,
    stripe_refund_id: stripeResult.id,
    refunded_at: now,
  }).eq("id", item.id);
  if (itemErr) throw itemErr;

  await onShopOrderRefunded(order.id, amount);

  const { data: items } = await admin.from("shop_order_items").select("id, refund_status").eq("order_id", order.id);
  const allRefunded = (items || []).every((row) => (row.refund_status || "none") === "refunded");
  const orderPatch = {
    refund_status: allRefunded ? "refunded" : "pending",
    updated_at: now,
  };
  if (allRefunded) orderPatch.refunded_at = now;
  await admin.from("shop_orders").update(orderPatch).eq("id", order.id);

  return {
    ok: true,
    amount,
    stripe: stripeResult,
    product_name: item.product?.name || "Item",
    order_refund_status: allRefunded ? "refunded" : "pending",
  };
}
