/** Product type → default inventory mode */

export const PRODUCT_TYPES = [
  { value: "food", label: "Food", inventoryMode: "batch_expiry" },
  { value: "treats", label: "Treats", inventoryMode: "batch_expiry" },
  { value: "supplements", label: "Supplements / aids", inventoryMode: "batch_expiry" },
  { value: "litter", label: "Litter", inventoryMode: "batch_expiry" },
  { value: "bowls", label: "Bowls", inventoryMode: "simple" },
  { value: "beds", label: "Beds", inventoryMode: "simple" },
  { value: "toys", label: "Toys", inventoryMode: "simple" },
  { value: "grooming", label: "Grooming", inventoryMode: "simple" },
  { value: "apparel", label: "Apparel", inventoryMode: "simple" },
  { value: "other", label: "Other", inventoryMode: "simple" },
];

export function defaultInventoryMode(productType) {
  const t = PRODUCT_TYPES.find((x) => x.value === productType);
  return t?.inventoryMode || "simple";
}

export function isBatchExpiryMode(mode) {
  return mode === "batch_expiry";
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + (String(dateStr).length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((end - start) / 86400000);
}

export function batchStatusFromExpiry(expiryDate, qty) {
  if (qty != null && qty <= 0) return "depleted";
  const days = daysUntil(expiryDate);
  if (days == null) return "active";
  if (days < 0) return "expired";
  if (days <= 7) return "near_expiry";
  if (days <= 14) return "near_expiry";
  return "active";
}
