import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canRateItem } from "@/lib/shopRatings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const postId = body?.post_id;
    const itemId = body?.order_item_id;
    if (!postId || !itemId) return NextResponse.json({ error: "post_id and order_item_id are required." }, { status: 400 });
    const access = await canRateItem(itemId, profile, { allowExistingReview: true });
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin
      .from("shop_kol_posts")
      .select("id, author_profile_id, status, source_type, verified_order_item_id, primary_product_id, pending_revision_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.author_profile_id !== profile.id || post.status !== "needs_changes" || post.source_type !== "verified_purchase" || post.verified_order_item_id !== itemId || post.primary_product_id !== access.item.product_id) {
      return NextResponse.json({ error: "This KOL post cannot be reopened." }, { status: 400 });
    }

    const { data: priorMedia } = await admin
      .from("shop_kol_post_media")
      .select("public_id, version, resource_type, sort_order, duration_seconds, width, height, bytes, phash")
      .eq("post_id", post.id)
      .eq("revision_id", post.pending_revision_id)
      .eq("lifecycle", "attached_private")
      .order("sort_order");
    if ((priorMedia || []).length) {
      const { error: cloneErr } = await admin.from("shop_kol_post_media").insert(
        priorMedia.map((media) => ({ ...media, post_id: post.id, revision_id: null, lifecycle: "unattached" }))
      );
      if (cloneErr) throw cloneErr;
    }

    const now = new Date().toISOString();
    const { error: postErr } = await admin
      .from("shop_kol_posts")
      .update({ status: "draft", pending_revision_id: null, updated_at: now })
      .eq("id", post.id)
      .eq("status", "needs_changes");
    if (postErr) throw postErr;
    const { error: eventErr } = await admin.from("kol_moderation_events").insert({
      post_id: post.id,
      revision_id: post.pending_revision_id,
      stage: "creator_revision",
      decision: "reopened_draft",
      reasons: [],
    });
    if (eventErr) throw eventErr;
    return NextResponse.json({ ok: true, status: "draft", copied_media: (priorMedia || []).length });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not reopen KOL draft." }, { status: 400 });
  }
}
