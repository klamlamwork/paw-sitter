import { daysUntil } from "@/lib/shopInventory";

export function buildExpiringRows(batches, variantMap, productMap) {
  const rows = [];
  for (const b of batches || []) {
    const days = daysUntil(b.expiry_date);
    if (days == null) continue;
    if (days > 14) continue;
    const v = variantMap[b.variant_id];
    const p = v ? productMap[v.product_id] : null;
    rows.push({
      id: b.id,
      days,
      expiryDate: b.expiry_date,
      qty: b.qty_on_hand ?? 0,
      lotCode: b.lot_code || "",
      status: b.status,
      variantName: v?.name || "Variety",
      productName: p?.name || "Product",
    });
  }
  rows.sort((a, b) => a.days - b.days || a.productName.localeCompare(b.productName));
  return rows;
}
