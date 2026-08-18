/** Split a net merchandise amount across original line items so Stripe shows the discounted total. */
export function netLineItems(items, netCents, currency = "cad") {
  const rows = (items || []).map((item) => ({
    name: item.name || item.product?.name || "Item",
    qty: Math.max(1, item.qty || 1),
    unit: Math.max(0, Number(item.price_cents || item.unit_amount) || 0),
  }));
  const gross = rows.reduce((sum, row) => sum + row.unit * row.qty, 0);
  const net = Math.max(0, Math.floor(Number(netCents) || 0));
  if (!rows.length || net <= 0) return [];
  if (!gross || net >= gross) {
    return rows.map((row) => ({
      quantity: row.qty,
      price_data: {
        currency,
        unit_amount: row.unit,
        product_data: { name: row.name },
      },
    }));
  }
  let allocated = 0;
  return rows.map((row, index) => {
    const share = row.unit * row.qty;
    const lineNet = index === rows.length - 1
      ? net - allocated
      : Math.floor((net * share) / gross);
    allocated += lineNet;
    const unitAmount = Math.max(0, Math.floor(lineNet / row.qty));
    return {
      quantity: row.qty,
      price_data: {
        currency,
        unit_amount: unitAmount,
        product_data: { name: `${row.name}${unitAmount < row.unit ? " (after promo/points)" : ""}` },
      },
    };
  }).filter((line) => line.price_data.unit_amount > 0);
}
