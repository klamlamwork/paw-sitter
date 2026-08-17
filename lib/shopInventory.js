import { createAdminClient } from "@/lib/supabase/admin";

export async function deductShopOrderStock(orderId) {
  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from("shop_orders")
    .select("id, seller_shop_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) throw new Error("Order not found");
  if (order.status !== "paid") throw new Error("Only paid orders can deduct stock");

  const { data: items, error: itemsErr } = await admin
    .from("shop_order_items")
    .select("product_id, variant_id, qty")
    .eq("order_id", orderId);
  if (itemsErr) throw itemsErr;

  for (const item of items || []) {
    const qty = item.qty || 0;
    if (qty <= 0) continue;

    const { data: batches, error: batchErr } = await admin
      .from("shop_product_batches")
      .select("id, qty, expires_at")
      .eq("product_id", item.product_id)
      .is("variant_id", item.variant_id || null)
      .eq("shop_id", order.seller_shop_id)
      .gt("qty", 0)
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(50);
    if (batchErr) throw batchErr;
    if (!batches?.length) throw new Error(`No stock for product ${item.product_id} (variant ${item.variant_id || "none"}) at shop ${order.seller_shop_id}`);

    let remaining = qty;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, b.qty || 0);
      if (take <= 0) continue;
      const { error: updateErr } = await admin
        .from("shop_product_batches")
        .update({ qty: (b.qty || 0) - take, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (updateErr) throw updateErr;
      remaining -= take;
    }
    if (remaining > 0) {
      throw new Error(`Insufficient stock for product ${item.product_id} (variant ${item.variant_id || "none"}); short ${remaining}`);
    }
  }

  return { ok: true };
}
