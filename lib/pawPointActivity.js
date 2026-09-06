import { bookingOrderLabel, shopOrderLabel } from "@/lib/shopOrderNumber";

const EARN_REASONS = new Set(["earn_order", "earn_booking", "earn_kol", "earn_referral"]);

function refFor(row) {
  if (row.order_id) return shopOrderLabel(row.order_id);
  if (row.booking_id) return bookingOrderLabel(row.booking_id);
  return "";
}

function reasonLabel(reason) {
  return {
    earn_order: "Earned from order",
    earn_booking: "Earned from service booking",
    earn_kol: "Paw Points earned",
    earn_referral: "Referral reward",
    admin_grant: "Paw Points adjustment",
    admin_adjust: "Paw Points adjustment",
  }[reason] || "Paw Points activity";
}

function keyFor(row, kind) {
  if (row.order_id) return `${kind}:order:${row.order_id}`;
  if (row.booking_id) return `${kind}:booking:${row.booking_id}`;
  return `${kind}:row:${row.id}`;
}

export function groupPawPointActivity(rows = []) {
  const redeems = new Map();
  const earns = new Map();
  const adjustments = [];

  for (const row of rows || []) {
    const delta = Number(row.delta || 0);
    if (row.reason === "redeem" && delta < 0) {
      const key = keyFor(row, "redeem");
      const current = redeems.get(key) || {
        id: key,
        kind: "redeem",
        points: 0,
        created_at: row.created_at,
        order_id: row.order_id,
        booking_id: row.booking_id,
      };
      current.points += Math.abs(delta);
      if (new Date(row.created_at) < new Date(current.created_at)) current.created_at = row.created_at;
      redeems.set(key, current);
      continue;
    }

    if (EARN_REASONS.has(row.reason) && delta > 0) {
      const root = row.lot_id || row.id;
      const key = `${row.reason}:${root}`;
      const current = earns.get(key) || {
        id: key,
        kind: "earn",
        reason: row.reason,
        remark: "",
        points: 0,
        pendingPoints: 0,
        availablePoints: 0,
        created_at: row.created_at,
        order_id: row.order_id,
        booking_id: row.booking_id,
      };
      if (row.remark) current.remark = row.remark;
      if (row.status === "available") current.availablePoints = Math.max(current.availablePoints, delta);
      else if (row.status === "pending") current.pendingPoints = Math.max(current.pendingPoints, delta);
      if (new Date(row.created_at) < new Date(current.created_at)) current.created_at = row.created_at;
      earns.set(key, current);
      continue;
    }

    if (delta !== 0 && row.reason !== "activate") {
      adjustments.push({
        id: row.id,
        kind: "adjustment",
        reason: row.reason,
        points: delta,
        created_at: row.created_at,
        order_id: row.order_id,
        booking_id: row.booking_id,
        remark: row.remark || "",
      });
    }
  }

  const out = [
    ...Array.from(redeems.values()).map((row) => ({
      ...row,
      label: `Redeemed on ${refFor(row) || "checkout"}`,
      detail: `${row.points} Paw Points applied`,
      status: "Redeemed",
      signedPoints: -row.points,
    })),
    ...Array.from(earns.values()).map((row) => {
      const points = row.availablePoints || row.pendingPoints;
      const available = row.availablePoints > 0;
      const kolLabel = row.reason === "earn_kol" && row.remark ? row.remark : "";
      return {
        ...row,
        points,
        label: kolLabel || `${reasonLabel(row.reason)}${refFor(row) ? ` · ${refFor(row)}` : ""}`,
        detail: available ? "Available to redeem" : "Pending until fulfillment is complete",
        status: available ? "Available" : "Pending",
        signedPoints: points,
      };
    }),
    ...adjustments.map((row) => ({
      ...row,
      label: row.remark || reasonLabel(row.reason),
      detail: refFor(row),
      status: row.reason === "clawback" || row.reason === "expire" ? "Adjustment" : "Available",
      signedPoints: row.points,
    })),
  ];

  return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
