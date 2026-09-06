import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";
import { addDays } from "@/lib/kolPolicy";

export const VERIFIED_TEXT_REVIEW_POINTS = 300;

function sourceKeyFor(reviewId) {
  return `shop_review:${reviewId}`;
}

export async function grantVerifiedTextReviewPoints({ userId, reviewId, orderId, availableAt }) {
  const qty = VERIFIED_TEXT_REVIEW_POINTS;
  if (!userId || !reviewId || qty <= 0) return null;
  const admin = createAdminClient();
  const sourceKey = sourceKeyFor(reviewId);
  const { data: existing } = await admin.from("paw_point_ledger").select("id").eq("source_key", sourceKey).gt("delta", 0).maybeSingle();
  if (existing) return existing;
  const pending = await appendLedger({
    user_id: userId,
    delta: qty,
    status: "pending",
    reason: "earn_kol",
    source_key: sourceKey,
    order_id: orderId || null,
    remark: "Paw Points earned · Review - Verified purchase",
    expires_at: addDays(new Date().toISOString(), 365),
    available_at: availableAt || null,
  });
  if (!availableAt || new Date(availableAt) <= new Date()) {
    await releaseReviewLot(pending);
  }
  return pending;
}

async function releaseReviewLot(pending) {
  if (!pending?.id) return;
  const admin = createAdminClient();
  const { data: already } = await admin.from("paw_point_ledger").select("id").eq("lot_id", pending.id).eq("status", "available").gt("delta", 0).maybeSingle();
  if (already) return;
  await appendLedger({
    user_id: pending.user_id,
    delta: pending.delta,
    status: "available",
    reason: "earn_kol",
    source_key: pending.source_key,
    lot_id: pending.id,
    order_id: pending.order_id || null,
    expires_at: pending.expires_at,
    remark: "Paw Points earned · Review - Verified purchase",
  });
  await appendLedger({
    user_id: pending.user_id,
    delta: -pending.delta,
    status: "pending",
    reason: "activate",
    lot_id: pending.id,
    order_id: pending.order_id || null,
    remark: "Pending converted to available",
  });
}

export async function releaseDueVerifiedTextReviewRewards() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows } = await admin
    .from("paw_point_ledger")
    .select("id, user_id, delta, source_key, order_id, expires_at, available_at")
    .eq("reason", "earn_kol")
    .eq("status", "pending")
    .gt("delta", 0)
    .like("source_key", "shop_review:%");
  const released = [];
  for (const row of rows || []) {
    if (row.available_at && new Date(row.available_at) > new Date(now)) continue;
    await releaseReviewLot(row);
    released.push(row.id);
  }
  return released;
}
