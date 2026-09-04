export function shopOrderDisplayTotals(order, settlement) {
  if (settlement && settlement.display_total_cents != null) {
    return {
      subtotal: Math.max(0, Number(settlement.merchandise_cents) || 0),
      discount: Math.max(0, Number(settlement.discount_cents) || 0),
      shipping: Math.max(0, Number(settlement.shipping_cents) || 0),
      pointsCents: Math.max(0, Number(settlement.points_redeemed_cents) || 0),
      total: Math.max(0, Number(settlement.display_total_cents) || 0),
    };
  }
  const subtotal = (order?.items || []).reduce(
    (sum, item) => sum + (Number(item.price_cents) || 0) * (Number(item.qty) || 0),
    0
  );
  const discount = Math.min(subtotal, Math.max(0, Number(order?.discount_cents) || 0));
  const shipping = Math.max(0, Number(order?.shipping_cents) || 0);
  const pointsCents = Math.min(Math.max(0, subtotal - discount), Math.max(0, Number(order?.paw_points_cents) || 0));
  return {
    subtotal,
    discount,
    shipping,
    pointsCents,
    total: Math.max(0, subtotal - discount - pointsCents) + shipping,
  };
}

export async function attachShopOrderDisplay(supabase, orders) {
  const list = orders || [];
  if (!list.length) return list;
  const map = {};
  try {
    const { data } = await supabase
      .from("shop_order_settlements")
      .select("order_id, merchandise_cents, discount_cents, shipping_cents, points_redeemed_cents, display_total_cents")
      .in("order_id", list.map((order) => order.id));
    for (const row of data || []) map[row.order_id] = row;
  } catch {
    /* table may not exist yet */
  }
  return list.map((order) => ({ ...order, display: shopOrderDisplayTotals(order, map[order.id]) }));
}
