import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { screenKolText } from "@/lib/kolTextModeration";
import { assertCommunityProductAccess, normalizeCommunityContentType } from "@/lib/kolCommunity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const postId = body?.post_id;
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    const contentType = normalizeCommunityContentType(body?.content_type);
    const rating = body?.rating == null || body?.rating === "" ? null : Number(body.rating);
    if (!postId) return NextResponse.json({ error: "post_id is required." }, { status: 400 });
    if (text.length < 8) return NextResponse.json({ error: "Please write a short post before submitting media." }, { status: 400 });
    if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return NextResponse.json({ error: "Rating must be 1 to 5 stars, or blank." }, { status: 400 });
    const screened = screenKolText({ title, body: text });
    if (!screened.ok) return NextResponse.json({ error: screened.message, reasons: screened.reasons }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin.from("shop_kol_posts").select("id, author_profile_id, source_type, status, primary_product_id").eq("id", postId).maybeSingle();
    if (!post || post.author_profile_id !== profile.id || post.source_type !== "community" || post.status !== "draft") {
      return NextResponse.json({ error: "Community draft not found." }, { status: 404 });
    }
    const product = await assertCommunityProductAccess(profile.id, post.primary_product_id);
    const { data: media } = await admin.from("shop_kol_post_media").select("id").eq("post_id", post.id).eq("lifecycle", "unattached").limit(11);
    if (!(media || []).length) return NextResponse.json({ error: "Add at least one photo or video first." }, { status: 400 });
    const { data: lastRevision } = await admin.from("shop_kol_post_revisions").select("revision_number").eq("post_id", post.id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
    const now = new Date().toISOString();
    const { data: revision, error: revisionErr } = await admin.from("shop_kol_post_revisions").insert({
      post_id: post.id,
      revision_number: Number(lastRevision?.revision_number || 0) + 1,
      title,
      body: text,
      rating,
      content_type: contentType,
      moderation_status: "pending",
      moderation_reasons: [],
      submitted_at: now,
    }).select("id").single();
    if (revisionErr) throw revisionErr;
    const { error: productErr } = await admin.from("shop_kol_post_products").upsert({ post_id: post.id, product_id: product.id, is_primary: true }, { onConflict: "post_id,product_id" });
    if (productErr) throw productErr;
    const { data: tags } = await admin.from("shop_product_tags").select("tag_id").eq("product_id", product.id);
    if ((tags || []).length) {
      const { error: tagErr } = await admin.from("shop_kol_post_tags").upsert((tags || []).map((row) => ({ post_id: post.id, tag_id: row.tag_id })), { onConflict: "post_id,tag_id" });
      if (tagErr) throw tagErr;
    }
    const { error: mediaErr } = await admin.from("shop_kol_post_media").update({ revision_id: revision.id, lifecycle: "attached_private" }).in("id", (media || []).map((row) => row.id)).eq("post_id", post.id).eq("lifecycle", "unattached");
    if (mediaErr) throw mediaErr;
    await admin.from("kol_upload_sessions").update({ status: "attached", attached_at: now }).eq("post_id", post.id).eq("status", "uploaded");
    const { error: postErr } = await admin.from("shop_kol_posts").update({ pending_revision_id: revision.id, content_type: contentType, status: "pending_admin", updated_at: now }).eq("id", post.id).eq("status", "draft");
    if (postErr) throw postErr;
    await admin.from("kol_moderation_events").insert({ post_id: post.id, revision_id: revision.id, stage: "deterministic_text", decision: "pending_admin", reasons: [] });
    return NextResponse.json({ ok: true, post_id: post.id, status: "pending_admin" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not submit the community post." }, { status: 400 });
  }
}
