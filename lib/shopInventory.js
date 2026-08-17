/** Product type → default inventory mode + batch sellability */

export const PRODUCT_TYPES = [
  { value: "food", label: "Food", inventoryMode: "batch_expiry" },
  { value: "treats", label: "Treats", inventoryMode: "batch_expiry" },
  { value: "treat", label: "Treat", inventoryMode: "batch_expiry" },
  { value: "supplements", label: "Supplements / aids", inventoryMode: "batch_expiry" },
  { value: "supplement", label: "Supplement", inventoryMode: "batch_expiry" },
  { value: "litter", label: "Litter", inventoryMode: "batch_expiry" },
  { value: "bowls", label: "Bowls", inventoryMode: "simple" },
  { value: "beds", label: "Beds", inventoryMode: "simple" },
  { value: "toys", label: "Toys", inventoryMode: "simple" },
  { value: "toy", label: "Toy", inventoryMode: "simple" },
  { value: "grooming", label: "Grooming", inventoryMode: "simple" },
  { value: "apparel", label: "Apparel", inventoryMode: "simple" },
  { value: "gear", label: "Gear", inventoryMode: "simple" },
  { value: "other", label: "Other", inventoryMode: "simple" },
];

export function defaultInventoryMode(productType) {
  const type = PRODUCT_TYPES.find((p) => p.value === productType);
  return type?.inventoryMode || "simple";
}

// Accept an inventory mode directly. Older callers may still pass a product type.
export function isBatchExpiryMode(modeOrProductType) {
  return modeOrProductType === "batch_expiry" || defaultInventoryMode(modeOrProductType) === "batch_expiry";
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function batchStatusFromExpiry(expiryDate, qty) {
  if (qty != null && qty <= 0) return "depleted";
  const days = daysUntil(expiryDate);
  if (days == null) return "active";
  if (days < 0) return "expired";
  if (days <= 14) return "near_expiry";
  return "active";
}

export function isSellableBatch(batch) {
  if (!batch) return false;
  const onHand = Number(batch.qty_on_hand || 0);
  const reserved = Number(batch.qty_reserved || 0);
  if (onHand - reserved <= 0) return false;
  if (["held", "depleted", "expired"].includes(batch.status)) return false;
  return !batch.expiry_date || daysUntil(batch.expiry_date) >= 0;
}

export function sellableQtyFromBatches(batches) {
  return (batches || []).reduce((total, batch) => {
    if (!isSellableBatch(batch)) return total;
    return total + Math.max(Number(batch.qty_on_hand || 0) - Number(batch.qty_reserved || 0), 0);
  }, 0);
}
