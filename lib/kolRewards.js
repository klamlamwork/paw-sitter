import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";
import {
  communityEquivalentPoints,
  orderBlocksVerifiedReward,
  rewardSourceKey,
  verifiedRewardAvailableAt,
  addDays,
  KOL_REWARD_HOLD_DAYS,
} from "@/lib/kolPolicy";

async function logReward(admin, row) {
  await admin.from("kol_reward_events").insert(row);
}

export async function grantKolPendingReward({ post, userId, points, orderId, availableAt }) {
  const qty = Math.floor(Number(points) || 0);
  if (qty <= 0) return null;
  const sourceKey = rewardSourceKey(post.id);
  const admin = createAdminClient();
  const { data: existing } = await admin.from("paw_point_ledger").select("id").eq("source_key", sourceKey).gt("delta", 0).maybeSingle();
  if (existing) return existing;
  const ledger = await appendLedger({
    user_id: userId,
    delta: qty,
    status: "pending",
    reason: "earn_kol",
    source_key: sourceKey,
    order_id: orderId || null,
    remark: "KOL reward pending hold",
    expires_at: addDays(new Date().toISOString(), 365),
    available_at: availableAt,
  });
  await admin.from("shop_kol_posts").update({
    reward_points: qty,
    reward_status: "pending",
    reward_available_at: availableAt,
    reward_source_key: sourceKey,
    updated_at: new Date().toISOString(),
  }).eq("id", post.id);
  await logReward(admin, {
    post_id: post.id,
    user_id: userId,
    order_id: orderId || null,
    action: "grant_pending",
    points: qty,
    source_key: sourceKey,
    ledger_id: ledger.id,
    remark: "Granted pending KOL reward",
  });
  return ledger;
}

export async function releaseDueKolRewards() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: posts } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, reward_points, reward_source_key, reward_available_at, verified_order_item_id, source_type")
    .eq("status", "published")
    .eq("reward_status", "pending")
    .lte("reward_available_at", now);
  const released = [];
  for (const post of posts || []) {
    if (post.source_type === "verified_purchase" && post.verified_order_item_id) {
      const { data: item } = await admin.from("shop_order_items").select("order_id").eq("id", post.verified_order_item_id).maybeSingle();
      if (item?.order_id) {
        const { data: order } = await admin.from("shop_orders").select("id, return_status, refund_status, return_window_ends_at").eq("id", item.order_id).maybeSingle();
        if (orderBlocksVerifiedReward(order)) {
          await convertVerifiedRewardToCommunity(post, order?.id);
          continue;
        }
      }
    }
    const { data: pending } = await admin.from("paw_point_ledger").select("id, user_id, delta, expires_at, source_key, order_id").eq("source_key", post.reward_source_key).eq("status", "pending").gt("delta", 0).maybeSingle();
    if (!pending) continue;
    const { data: already } = await admin.from("paw_point_ledger").select("id").eq("lot_id", pending.id).eq("status", "available").gt("delta", 0).maybeSingle();
    if (already) {
      await admin.from("shop_kol_posts").update({ reward_status: "available", updated_at: now }).eq("id", post.id);
      continue;
    }
    const avail = await appendLedger({
      user_id: pending.user_id,
      delta: pending.delta,
      status: "available",
      reason: "earn_kol",
      source_key: pending.source_key,
      lot_id: pending.id,
      order_id: pending.order_id,
      expires_at: pending.expires_at,
      remark: "KOL reward available",
    });
    await appendLedger({
      user_id: pending.user_id,
      delta: -pending.delta,
      status: "pending",
      reason: "activate",
      lot_id: pending.id,
      order_id: pending.order_id,
      remark: "Pending converted to available",
    });
    await admin.from("shop_kol_posts").update({ reward_status: "available", updated_at: now }).eq("id", post.id);
    await logReward(admin, {
      post_id: post.id,
      user_id: pending.user_id,
      order_id: pending.order_id,
      action: "release_available",
      points: pending.delta,
      source_key: pending.source_key,
      ledger_id: avail.id,
      remark: "Released after hold/return window",
    });
    released.push(post.id);
  }
  return released;
}

export async function convertVerifiedRewardToCommunity(post, orderId) {
  const admin = createAdminClient();
  const communityPts = communityEquivalentPoints(post.reward_points || 0);
  const sourceKey = post.reward_source_key || rewardSourceKey(post.id);
  const { data: pending } = await admin.from("paw_point_ledger").select("id, user_id, delta").eq("source_key", sourceKey).eq("status", "pending").gt("delta", 0).maybeSingle();
  if (pending) {
    await appendLedger({
      user_id: pending.user_id,
      delta: -pending.delta,
      status: "pending",
      reason: "clawback",
      lot_id: pending.id,
      order_id: orderId || null,
      remark: "Verified KOL reward cancelled after return/refund",
    });
    if (communityPts > 0) {
      await appendLedger({
        user_id: pending.user_id,
        delta: communityPts,
        status: "pending",
        reason: "earn_kol",
        source_key: `${sourceKey}:community`,
        order_id: orderId || null,
        available_at: addDays(new Date().toISOString(), KOL_REWARD_HOLD_DAYS),
        remark: "Converted to community KOL reward",
      });
    }
  } else {
    const { data: avail } = await admin.from("paw_point_ledger").select("id, user_id, delta").eq("source_key", sourceKey).eq("status", "available").gt("delta", 0).maybeSingle();
    if (avail) {
      const reverse = Math.max(0, avail.delta - communityPts);
      if (reverse > 0) {
        await appendLedger({
          user_id: avail.user_id,
          delta: -reverse,
          status: "clawed",
          reason: "clawback",
          lot_id: avail.id,
          order_id: orderId || null,
          remark: "Reduced verified KOL reward to community equivalent",
        });
      }
    }
  }
  await admin.from("shop_kol_posts").update({
    verified_badge: false,
    source_type: "community",
    reward_points: communityPts,
    reward_status: communityPts ? "pending" : "converted_community",
    updated_at: new Date().toISOString(),
  }).eq("id", post.id);
  await logReward(admin, {
    post_id: post.id,
    user_id: post.author_profile_id,
    order_id: orderId || null,
    action: "convert_community",
    points: communityPts,
    source_key: sourceKey,
    remark: "Verified purchase reversed; community reward retained",
  });
}

export function availableAtForPost(post, order) {
  if (post.source_type === "verified_purchase") return verifiedRewardAvailableAt(order, post.published_at);
  return addDays(post.published_at || new Date().toISOString(), KOL_REWARD_HOLD_DAYS);
}
