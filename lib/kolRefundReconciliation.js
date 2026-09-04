import { createAdminClient } from "@/lib/supabase/admin";
import { convertVerifiedRewardToCommunity } from "@/lib/kolRewards";

export async function reconcileVerifiedKolForRefundedItem(orderItemId) {
  if (!orderItemId) return [];
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("id, order_id, qty, refunded_qty")
    .eq("id", orderItemId)
    .maybeSingle();
  if (!item || Number(item.refunded_qty || 0) < Number(item.qty || 0)) return [];

  const { data: posts } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, status, source_type, reward_points, reward_source_key")
    .eq("verified_order_item_id", item.id)
    .eq("source_type", "verified_purchase");
  const changed = [];
  for (const post of posts || []) {
    if (post.status === "published") {
      await convertVerifiedRewardToCommunity(post, item.order_id);
      changed.push(post.id);
      continue;
    }
    const now = new Date().toISOString();
    const { error } = await admin
      .from("shop_kol_posts")
      .update({
        source_type: "community",
        verified_badge: false,
        reward_points: 0,
        reward_status: "none",
        reward_available_at: null,
        reward_source_key: null,
        updated_at: now,
      })
      .eq("id", post.id)
      .eq("source_type", "verified_purchase");
    if (error) throw error;
    await admin.from("kol_moderation_events").insert({
      post_id: post.id,
      stage: "verification_reconcile",
      decision: "converted_community",
      reasons: ["verified_order_item_fully_refunded"],
    });
    changed.push(post.id);
  }
  return changed;
}

export async function reconcileVerifiedKolForOrder(orderId) {
  if (!orderId) return [];
  const admin = createAdminClient();
  const { data: items } = await admin.from("shop_order_items").select("id").eq("order_id", orderId);
  const changed = [];
  for (const item of items || []) changed.push(...(await reconcileVerifiedKolForRefundedItem(item.id)));
  return changed;
}
