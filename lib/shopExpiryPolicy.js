import { daysUntil } from "./shopInventory";

export function batchDaysLeft(batch) {
  return daysUntil(batch?.expiry_date);
}

/** Hide if expired, or if days left <= hideDays (when hideDays > 0) */
export function isHiddenByExpiryPolicy(batch, hideDays = 0) {
  const days = batchDaysLeft(batch);
  if (days == null) return false;
  if (days < 0) return true;
  if (hideDays > 0 && days <= hideDays) return true;
  return false;
}

export function isSellableBatchWithPolicy(batch, hideDays = 0) {
  if (!batch) return false;
  const onHand = batch.qty_on_hand || 0;
  const reserved = batch.qty_reserved || 0;
  if (onHand - reserved <= 0) return false;
  if (batch.status === "held" || batch.status === "depleted" || batch.status === "expired") {
    return false;
  }
  if (isHiddenByExpiryPolicy(batch, hideDays)) return false;
  return true;
}

export function sellableQtyWithPolicy(batches, hideDays = 0) {
  return (batches || []).reduce((sum, b) => {
    if (!isSellableBatchWithPolicy(b, hideDays)) return sum;
    return sum + Math.max((b.qty_on_hand || 0) - (b.qty_reserved || 0), 0);
  }, 0);
}

export function applyExpiryDiscount(cents, pct) {
  if (cents == null || !Number.isFinite(Number(cents))) return cents;
  const p = Math.min(90, Math.max(0, Number(pct) || 0));
  if (p <= 0) return cents;
  return Math.round(Number(cents) * (100 - p) / 100);
}

export function firstFefoLot(batches, hideDays = 0) {
  const sellable = (batches || [])
    .filter((b) => isSellableBatchWithPolicy(b, hideDays))
    .slice()
    .sort((a, b) => {
      const da = a.expiry_date || "9999-12-31";
      const db = b.expiry_date || "9999-12-31";
      return da.localeCompare(db);
    });
  return sellable[0] || null;
}

export function lotGetsDiscount(batch, discountDays) {
  if (!discountDays || discountDays <= 0) return false;
  const days = batchDaysLeft(batch);
  if (days == null) return false;
  return days >= 0 && days <= discountDays;
}
