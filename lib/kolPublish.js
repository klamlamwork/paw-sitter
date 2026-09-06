import { createAdminClient } from "@/lib/supabase/admin";
import { availableAtForPost, grantKolPendingReward } from "@/lib/kolRewards";
import { rewardFor } from "@/lib/kolPolicy";
import { uniqueKolSlug } from "@/lib/kolPublic";
import { releaseCommunityKolReward } from "@/lib/kolCommunityRewards";

export async function publishKolPost({ postId, adminProfileId }) {
  if (!postId) throw new Error("post_id is required.");
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, source_type, status, pending_revision_id, verified_order_item_id, primary_product_id, reward_source_key, slug")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.status !== "pending_admin" || !post.pending_revision_id) throw new Error("This KOL post is not awaiting review.");

  const { data: media } = await admin.from("shop_kol_post_media").select("id, resource_type").eq("post_id", post.id).eq("lifecycle", "attached_private");
  if (!(media || []).length) throw new Error("This submission has no private media to publish.");

  let sourceType = post.source_type === "verified_purchase" ? "verified_purchase" : "community";
  let order = null;
  if (post.verified_order_item_id) {
    const { data: item } = await admin.from("shop_order_items").select("id, qty, refunded_qty, order_id").eq("id", post.verified_order_item_id).maybeSingle();
    if (!item || Number(item.refunded_qty || 0) >= Number(item.qty || 0)) sourceType = "community";
    else if (item.order_id) {
      const { data: loaded } = await admin.from("shop_orders").select("id, return_window_ends_at, return_status, refund_status").eq("id", item.order_id).maybeSingle();
      order = loaded;
    }
  } else sourceType = "community";

  const hasVideo = (media || []).some((row) => row.resource_type === "video");
  const hasPhoto = (media || []).some((row) => row.resource_type === "image");
  const points = rewardFor({ sourceType, hasVideo, hasPhoto });
  const now = new Date().toISOString();
  const publishedPost = { ...post, source_type: sourceType, published_at: now };
  const availableAt = availableAtForPost(publishedPost, order);
  const { data: revision } = await admin.from("shop_kol_post_revisions").select("title").eq("id", post.pending_revision_id).maybeSingle();
  const slug = post.slug || await uniqueKolSlug(admin, revision?.title, post.id);

  if (points > 0) {
    await grantKolPendingReward({ post: publishedPost, userId: post.author_profile_id, points, orderId: order?.id || null, availableAt });
  }
  const { error: revisionErr } = await admin.from("shop_kol_post_revisions").update({ moderation_status: "approved_admin", reviewed_at: now, reviewed_by: adminProfileId }).eq("id", post.pending_revision_id).eq("post_id", post.id);
  if (revisionErr) throw revisionErr;
  const { error: mediaErr } = await admin.from("shop_kol_post_media").update({ lifecycle: "published" }).eq("post_id", post.id).eq("lifecycle", "attached_private");
  if (mediaErr) throw mediaErr;
  const { error: postErr } = await admin.from("shop_kol_posts").update({ status: "published", source_type: sourceType, verified_badge: sourceType === "verified_purchase", published_revision_id: post.pending_revision_id, pending_revision_id: null, published_at: now, slug, updated_at: now }).eq("id", post.id).eq("status", "pending_admin");
  if (postErr) throw postErr;
  if (sourceType === "community" && points > 0) await releaseCommunityKolReward(post.id);
  await admin.from("kol_moderation_events").insert({ post_id: post.id, revision_id: post.pending_revision_id, stage: "admin_review", decision: "published", reasons: [sourceType === "verified_purchase" ? "verified_purchase" : "community"] });
  return { ok: true, status: "published", source_type: sourceType, reward_points: points, reward_available_at: availableAt, slug };
}
