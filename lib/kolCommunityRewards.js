import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/pawPoints";

export async function releaseCommunityKolReward(postId) {
  if (!postId) return null;
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, source_type, status, reward_status, reward_source_key, reward_points")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.source_type !== "community" || post.status !== "published" || post.reward_status === "available" || !post.reward_source_key) return null;
  const { data: pending } = await admin
    .from("paw_point_ledger")
    .select("id, user_id, delta, source_key, order_id, expires_at")
    .eq("source_key", post.reward_source_key)
    .eq("status", "pending")
    .gt("delta", 0)
    .maybeSingle();
  if (!pending) return null;
  const { data: already } = await admin.from("paw_point_ledger").select("id").eq("lot_id", pending.id).eq("status", "available").gt("delta", 0).maybeSingle();
  if (!already) {
    await appendLedger({ user_id: pending.user_id, delta: pending.delta, status: "available", reason: "earn_kol", source_key: pending.source_key, lot_id: pending.id, order_id: pending.order_id || null, expires_at: pending.expires_at, remark: "Paw Points earned · Review - Community" });
    await appendLedger({ user_id: pending.user_id, delta: -pending.delta, status: "pending", reason: "activate", lot_id: pending.id, order_id: pending.order_id || null, remark: "Pending converted to available" });
  }
  await admin.from("shop_kol_posts").update({ reward_status: "available", updated_at: new Date().toISOString() }).eq("id", post.id);
  await admin.from("kol_reward_events").insert({ post_id: post.id, user_id: post.author_profile_id, action: "release_available", points: pending.delta, source_key: pending.source_key, ledger_id: already?.id || null, remark: "Community KOL reward available on publish" });
  return post.id;
}

export async function releasePublishedCommunityKolRewards() {
  const admin = createAdminClient();
  const { data: posts } = await admin.from("shop_kol_posts").select("id").eq("status", "published").eq("source_type", "community").eq("reward_status", "pending");
  const released = [];
  for (const post of posts || []) {
    if (await releaseCommunityKolReward(post.id)) released.push(post.id);
  }
  return released;
}
