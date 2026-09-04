import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";

const HOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function shopEarnAvailableAt(order, now = new Date()) {
  if (order?.return_window_ends_at) {
    const d = new Date(order.return_window_ends_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (order?.delivered_at) {
    const d = new Date(order.delivered_at);
    if (!Number.isNaN(d.getTime())) return new Date(d.getTime() + HOLD_MS);
  }
  return null;
}

async function leftoverAvailable(admin, row) {
  const { data: spent } = await admin
    .from("paw_point_ledger")
    .select("delta")
    .eq("lot_id", row.id)
    .lt("delta", 0);
  const used = (spent || []).reduce((sum, line) => sum + Math.abs(Number(line.delta) || 0), 0);
  return Math.max(0, Math.floor(Number(row.delta) || 0) - used);
}

export async function restorePrematureShopEarn(orderId) {
  if (!orderId) return 0;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("paw_point_ledger")
    .select("id, user_id, delta, order_id, expires_at, source_key")
    .eq("order_id", orderId)
    .eq("reason", "earn_order")
    .eq("status", "available")
    .gt("delta", 0);
  let restored = 0;
  for (const row of rows || []) {
    const leftover = await leftoverAvailable(admin, row);
    if (leftover <= 0) continue;
    await appendLedger({
      user_id: row.user_id,
      delta: -leftover,
      status: "available",
      reason: "activate",
      lot_id: row.id,
      order_id: orderId,
      remark: "Held until 7 days after delivery",
    });
    await appendLedger({
      user_id: row.user_id,
      delta: leftover,
      status: "pending",
      reason: "earn_order",
      source_key: row.source_key || "other",
      lot_id: row.id,
      order_id: orderId,
      expires_at: row.expires_at,
      remark: "Earnings - Shop order",
    });
    restored += leftover;
  }
  return restored;
}

export async function activatePendingShopOrderEarn(orderId) {
  if (!orderId) return 0;
  const admin = createAdminClient();
  const { data: earns } = await admin
    .from("paw_point_ledger")
    .select("id, user_id, delta, expires_at, source_key")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .eq("reason", "earn_order")
    .gt("delta", 0);
  const { data: claws } = await admin
    .from("paw_point_ledger")
    .select("delta")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .eq("reason", "clawback")
    .lt("delta", 0);
  let clawLeft = (claws || []).reduce((sum, row) => sum + Math.abs(Number(row.delta) || 0), 0);
  let released = 0;
  for (const lot of earns || []) {
    const { data: already } = await admin
      .from("paw_point_ledger")
      .select("id")
      .eq("lot_id", lot.id)
      .eq("status", "available")
      .gt("delta", 0)
      .limit(1);
    if ((already || []).length) continue;
    let grant = Math.max(0, Math.floor(Number(lot.delta) || 0));
    if (clawLeft > 0) {
      const used = Math.min(grant, clawLeft);
      grant -= used;
      clawLeft -= used;
    }
    await appendLedger({
      user_id: lot.user_id,
      delta: -Math.floor(Number(lot.delta) || 0),
      status: "pending",
      reason: "activate",
      lot_id: lot.id,
      order_id: orderId,
      remark: "Pending converted to available",
    });
    if (grant > 0) {
      await appendLedger({
        user_id: lot.user_id,
        delta: grant,
        status: "available",
        reason: "earn_order",
        source_key: lot.source_key || "other",
        lot_id: lot.id,
        order_id: orderId,
        expires_at: lot.expires_at,
        remark: "Available after 7-day refund window",
      });
      released += grant;
    }
  }
  return released;
}

export async function releaseDueShopOrderEarns() {
  const admin = createAdminClient();
  const now = new Date();
  const { data: orders, error } = await admin
    .from("shop_orders")
    .select("id, delivered_at, return_window_ends_at, payment_status, refund_status, status")
    .eq("status", "delivered")
    .in("payment_status", ["paid", "partially_refunded", "refunded"])
    .order("delivered_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const released = [];
  const restored = [];
  for (const order of orders || []) {
    const availableAt = shopEarnAvailableAt(order, now);
    if (!availableAt) continue;
    if (now.getTime() < availableAt.getTime()) {
      const pts = await restorePrematureShopEarn(order.id);
      if (pts > 0) restored.push(order.id);
      continue;
    }
    if ((order.refund_status || "none") === "refunded") continue;
    const pts = await activatePendingShopOrderEarn(order.id);
    if (pts > 0) released.push(order.id);
  }
  return { released, restored };
}
