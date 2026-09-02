/**
 * KOL Phase 3a-1: return/refund state machine for shop_orders.
 * Uses columns added in sql/90-kol-foundation.sql. Not wired to UI yet.
 * Verified KOL rewards must not go live until this workflow is connected.
 */

export const RETURN_STATUSES = ["none", "requested", "approved", "received", "rejected"];
export const REFUND_STATUSES = ["none", "pending", "refunded", "chargeback_open", "chargeback_lost", "chargeback_won"];

export const RETURN_TRANSITIONS = {
  customer: {
    none: ["requested"],
    rejected: ["requested"],
  },
  seller: {
    requested: ["approved", "rejected"],
    approved: ["received"],
  },
  admin: {
    none: ["requested", "approved", "rejected"],
    requested: ["approved", "rejected", "none"],
    approved: ["received", "rejected", "requested"],
    received: ["approved"],
    rejected: ["none", "requested", "approved"],
  },
};

export const REFUND_TRANSITIONS = {
  admin: {
    none: ["pending", "chargeback_open"],
    pending: ["refunded", "none"],
    refunded: ["none"],
    chargeback_open: ["chargeback_lost", "chargeback_won", "none"],
    chargeback_lost: ["none"],
    chargeback_won: ["none"],
  },
};

export function canTransition(map, actor, from, to) {
  const allowed = map?.[actor]?.[from] || [];
  return allowed.includes(to);
}

export function canRequestReturn(order, now = new Date()) {
  if (!order) return false;
  if ((order.return_status || "none") !== "none" && order.return_status !== "rejected") return false;
  if (order.status !== "delivered") return false;
  if (!order.return_window_ends_at) return true;
  return new Date(order.return_window_ends_at).getTime() >= now.getTime();
}

export function canChangeReturnStatus(actor, from, to) {
  return canTransition(RETURN_TRANSITIONS, actor, from || "none", to);
}

export function canChangeRefundStatus(actor, from, to) {
  return canTransition(REFUND_TRANSITIONS, actor, from || "none", to);
}

export function orderBlocksVerifiedKolReward(order) {
  if (!order) return true;
  const returnBlocked = !["none", "rejected"].includes(order.return_status || "none");
  const refundBlocked = !["none", "chargeback_won"].includes(order.refund_status || "none");
  return returnBlocked || refundBlocked;
}

export function nextReturnPatch(actor, order, toStatus) {
  const from = order?.return_status || "none";
  if (!canChangeReturnStatus(actor, from, toStatus)) {
    throw new Error(`Cannot change return status from ${from} to ${toStatus} as ${actor}.`);
  }
  const patch = { return_status: toStatus, updated_at: new Date().toISOString() };
  if (toStatus === "requested") patch.return_requested_at = new Date().toISOString();
  return patch;
}

export function nextRefundPatch(actor, order, toStatus) {
  const from = order?.refund_status || "none";
  if (!canChangeRefundStatus(actor, from, toStatus)) {
    throw new Error(`Cannot change refund status from ${from} to ${toStatus} as ${actor}.`);
  }
  const patch = { refund_status: toStatus, updated_at: new Date().toISOString() };
  if (toStatus === "refunded") patch.refunded_at = new Date().toISOString();
  if (toStatus === "chargeback_open") patch.chargeback_opened_at = new Date().toISOString();
  return patch;
}
