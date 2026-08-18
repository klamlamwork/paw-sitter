import { createAdminClient } from "@/lib/supabase/admin";

export const POINT_CENTS = 0.2;
export const MIN_REDEEM = 100;
export const MAX_REDEEM_PCT = 40;

export function pointsFromCents(cents, pointsPerDollar) {
  const dollars = Math.max(0, Number(cents) || 0) / 100;
  return Math.floor(dollars * (Number(pointsPerDollar) || 0));
}

export function centsFromPoints(points) {
  return Math.floor(Math.max(0, Number(points) || 0) * POINT_CENTS);
}

export function clampRedeem(points, available, orderCents) {
  const want = Math.floor(Number(points) || 0);
  if (want < MIN_REDEEM) return { ok: false, points: 0, cents: 0, reason: `Redeem at least ${MIN_REDEEM} Paw Points.` };
  const capCents = Math.floor((Math.max(0, Number(orderCents) || 0) * MAX_REDEEM_PCT) / 100);
  const capPoints = Math.floor(capCents / POINT_CENTS);
  const use = Math.min(want, available, capPoints);
  if (use < MIN_REDEEM) return { ok: false, points: 0, cents: 0, reason: "Not enough redeemable points for this order." };
  return { ok: true, points: use, cents: centsFromPoints(use) };
}

export async function loadPointConfig() {
  const admin = createAdminClient();
  const [{ data: settings }, { data: rates }] = await Promise.all([
    admin.from("paw_point_settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("paw_point_earn_rates").select("*"),
  ]);
  return {
    settings: settings || {
      cents_per_point: POINT_CENTS,
      min_redeem_points: MIN_REDEEM,
      max_redeem_pct: MAX_REDEEM_PCT,
      default_product_points_per_dollar: 10,
      booking_points_per_dollar: 5,
    },
    rates: Object.fromEntries((rates || []).map((r) => [r.source_key, r])),
  };
}

export async function getBalance(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_user_paw_balance", { p_user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    available: Number(row?.available || 0),
    pending: Number(row?.pending || 0),
    reserved: Number(row?.reserved || 0),
  };
}

export function earnPointsForItems(items, rates, defaultRate = 10) {
  let points = 0;
  for (const item of items || []) {
    const key = item.product_type || item.source_key || "other";
    const rate = rates[key]?.points_per_dollar ?? defaultRate;
    const net = Math.max(0, Number(item.net_cents || item.price_cents || 0) * (item.qty || 1));
    points += pointsFromCents(net, rate);
  }
  return points;
}

export async function appendLedger(row) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("paw_point_ledger").insert(row).select("id").single();
  if (error) throw error;
  return data;
}

export async function grantPendingEarn({ userId, points, reason, sourceKey, orderId, bookingId, remark }) {
  const qty = Math.floor(Number(points) || 0);
  if (qty <= 0) return null;
  return appendLedger({
    user_id: userId,
    delta: qty,
    status: "pending",
    reason,
    source_key: sourceKey || null,
    order_id: orderId || null,
    booking_id: bookingId || null,
    remark: remark || "",
    expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  });
}

export async function activatePendingFor({ orderId, bookingId }) {
  const admin = createAdminClient();
  let q = admin.from("paw_point_ledger").select("id, user_id, delta, expires_at, source_key, reason").eq("status", "pending").gt("delta", 0);
  if (orderId) q = q.eq("order_id", orderId);
  else if (bookingId) q = q.eq("booking_id", bookingId);
  else return [];
  const { data: rows, error } = await q;
  if (error) throw error;
  const activated = [];
  for (const row of rows || []) {
    await appendLedger({
      user_id: row.user_id,
      delta: -row.delta,
      status: "pending",
      reason: "activate",
      lot_id: row.id,
      order_id: orderId || null,
      booking_id: bookingId || null,
      remark: "Pending converted to available",
    });
    const avail = await appendLedger({
      user_id: row.user_id,
      delta: row.delta,
      status: "available",
      reason: row.reason,
      source_key: row.source_key,
      lot_id: row.id,
      order_id: orderId || null,
      booking_id: bookingId || null,
      expires_at: row.expires_at,
      remark: "Available after fulfillment",
    });
    activated.push(avail);
  }
  return activated;
}

export async function reserveRedeem({ userId, points, orderId, bookingId }) {
  const admin = createAdminClient();
  const want = Math.floor(Number(points) || 0);
  if (want <= 0) return { points: 0, cents: 0, lots: [] };
  const { data: lots, error } = await admin
    .from("paw_point_ledger")
    .select("id, delta, created_at")
    .eq("user_id", userId)
    .eq("status", "available")
    .gt("delta", 0)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const { data: spent } = await admin
    .from("paw_point_ledger")
    .select("lot_id, delta")
    .eq("user_id", userId)
    .in("status", ["available", "reserved"])
    .lt("delta", 0);
  const usedByLot = {};
  for (const s of spent || []) {
    if (!s.lot_id) continue;
    usedByLot[s.lot_id] = (usedByLot[s.lot_id] || 0) + Math.abs(s.delta);
  }
  let left = want;
  const moves = [];
  for (const lot of lots || []) {
    if (left <= 0) break;
    const remaining = lot.delta - (usedByLot[lot.id] || 0);
    if (remaining <= 0) continue;
    const take = Math.min(left, remaining);
    await appendLedger({
      user_id: userId,
      delta: -take,
      status: "reserved",
      reason: "redeem",
      lot_id: lot.id,
      order_id: orderId || null,
      booking_id: bookingId || null,
      remark: "Reserved at checkout",
    });
    moves.push({ lotId: lot.id, points: take });
    left -= take;
  }
  const used = want - left;
  return { points: used, cents: centsFromPoints(used), lots: moves };
}

export async function finalizeReserved({ orderId, bookingId }) {
  const admin = createAdminClient();
  let q = admin.from("paw_point_ledger").update({ status: "available", remark: "Redeem posted" }).eq("status", "reserved").eq("reason", "redeem");
  if (orderId) q = q.eq("order_id", orderId);
  if (bookingId) q = q.eq("booking_id", bookingId);
  const { error } = await q;
  if (error) throw error;
}

export async function clawbackFor({ orderId, bookingId, refundCents }) {
  const admin = createAdminClient();
  let q = admin.from("paw_point_ledger").select("*").in("status", ["pending", "available", "reserved"]);
  if (orderId) q = q.eq("order_id", orderId);
  else q = q.eq("booking_id", bookingId);
  const { data: rows, error } = await q;
  if (error) throw error;
  let cashOffsetCents = 0;
  for (const row of rows || []) {
    if (row.delta > 0 && (row.status === "pending" || row.status === "available")) {
      await appendLedger({
        user_id: row.user_id,
        delta: -row.delta,
        status: "clawed",
        reason: "clawback",
        lot_id: row.id,
        order_id: orderId || null,
        booking_id: bookingId || null,
        remark: "Clawback after refund",
      });
    }
  }
  const redeemed = (rows || []).filter((r) => r.reason === "redeem" && r.delta < 0);
  const redeemedPts = redeemed.reduce((s, r) => s + Math.abs(r.delta), 0);
  if (redeemedPts > 0) {
    cashOffsetCents = centsFromPoints(redeemedPts);
    if (redeemed[0]) {
      await appendLedger({
        user_id: redeemed[0].user_id,
        delta: 0,
        status: "clawed",
        reason: "cash_offset",
        order_id: orderId || null,
        booking_id: bookingId || null,
        remark: `Deduct ${cashOffsetCents} cents from cash refund for spent points`,
      });
    }
  }
  return { cashOffsetCents, refundCents: Math.max(0, (refundCents || 0) - cashOffsetCents) };
}

export async function expireInactive() {
  const admin = createAdminClient();
  const { data: settings } = await admin.from("paw_point_settings").select("expire_inactive_months").eq("id", 1).maybeSingle();
  const months = settings?.expire_inactive_months || 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const { data: stale } = await admin.from("profiles").select("id").lt("last_active_at", cutoff.toISOString());
  const notes = [];
  for (const p of stale || []) {
    const { data: lots } = await admin.from("paw_point_ledger").select("id, delta").eq("user_id", p.id).eq("status", "available").gt("delta", 0);
    for (const lot of lots || []) {
      await appendLedger({
        user_id: p.id,
        delta: -lot.delta,
        status: "expired",
        reason: "expire",
        lot_id: lot.id,
        remark: `Expired after ${months} months inactivity`,
      });
    }
    if (lots?.length) notes.push(p.id);
  }
  return notes;
}
