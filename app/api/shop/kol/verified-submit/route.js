import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canRateItem } from "@/lib/shopRatings";
import { screenKolText } from "@/lib/kolTextModeration";
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
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    const rating = Number(body?.rating);
    if (!postId || !itemId) return NextResponse.json({ error: "post_id and order_item_id are required." }, { status: 400 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose 1 to 5 stars." }, { status: 400 });
    if (text.length < 8) return NextResponse.json({ error: "Please write a short review before submitting media." }, { status: 400 });

    const access = await canRateItem(itemId, profile);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 400 });
    const screened = screenKolText({ title, body: text });
    if (!screened.ok) return NextResponse.json({ error: screened.message, reasons: screened.reasons }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin
      .from("shop_kol_posts")
      .select("id, author_profile_id, source_type, status, verified_order_item_id, primary_product_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.author_profile_id !== profile.id || post.source_type !== "verified_purchase" || post.status !== "draft" || post.verified_order_item_id !== itemId || post.primary_product_id !== access.item.product_id) {
      return NextResponse.json({ error: "Verified media draft not found." }, { status: 404 });
    }

    const { data: media } = await admin
      .from("shop_kol_post_media")
      .select("id")
      .eq("post_id", post.id)
      .eq("lifecycle", "unattached")
      .limit(11);
    if (!(media || []).length) return NextResponse.json({ error: "Add at least one photo or video first." }, { status: 400 });

    const { data: lastRevision } = await admin
      .from("shop_kol_post_revisions")
      .select("revision_number")
      .eq("post_id", post.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const revisionNumber = Number(lastRevision?.revision_number || 0) + 1;
    const now = new Date().toISOString();
    const { data: revision, error: revisionErr } = await admin
      .from("shop_kol_post_revisions")
      .insert({
        post_id: post.id,
        revision_number: revisionNumber,
        title,
        body: text,
        rating,
        content_type: "review",
        moderation_status: "pending",
        moderation_reasons: [],
        submitted_at: now,
      })
      .select("id")
      .single();
    if (revisionErr) throw revisionErr;

    const { error: productErr } = await admin
      .from("shop_kol_post_products")
      .upsert({ post_id: post.id, product_id: access.item.product_id, is_primary: true }, { onConflict: "post_id,product_id" });
    if (productErr) throw productErr;

    const { data: tags } = await admin
      .from("shop_product_tags")
      .select("tag_id")
      .eq("product_id", access.item.product_id);
    if ((tags || []).length) {
      const { error: tagErr } = await admin
        .from("shop_kol_post_tags")
        .upsert((tags || []).map((row) => ({ post_id: post.id, tag_id: row.tag_id })), { onConflict: "post_id,tag_id" });
      if (tagErr) throw tagErr;
    }

    const mediaIds = (media || []).map((row) => row.id);
    const { error: mediaErr } = await admin
      .from("shop_kol_post_media")
      .update({ revision_id: revision.id, lifecycle: "attached_private" })
      .in("id", mediaIds)
      .eq("post_id", post.id)
      .eq("lifecycle", "unattached");
    if (mediaErr) throw mediaErr;
    await admin.from("kol_upload_sessions").update({ status: "attached", attached_at: now }).eq("post_id", post.id).eq("status", "uploaded");

    const { error: postErr } = await admin
      .from("shop_kol_posts")
      .update({ pending_revision_id: revision.id, status: "pending_admin", updated_at: now })
      .eq("id", post.id)
      .eq("status", "draft");
    if (postErr) throw postErr;

    await admin.from("kol_moderation_events").insert({
      post_id: post.id,
      revision_id: revision.id,
      stage: "deterministic_text",
      decision: "pending_admin",
      reasons: [],
    });
    return NextResponse.json({ ok: true, post_id: post.id, status: "pending_admin" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not submit the media review." }, { status: 400 });
  }
}
