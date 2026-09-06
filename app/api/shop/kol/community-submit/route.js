import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { screenKolText } from "@/lib/kolTextModeration";
import { assertCommunityProducts, linkCommunityProducts, normalizeCommunityContentType } from "@/lib/kolCommunity";
import { optionsForProduct } from "@/lib/shopRatings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function stoodOutForPost(products, body) {
  const requested = Array.isArray(body?.stood_out) ? body.stood_out : [];
  const byProduct = new Map();
  for (const row of requested) {
    if (row?.product_id) byProduct.set(String(row.product_id), Array.isArray(row.option_ids) ? row.option_ids : []);
  }
  const stoodOut = [];
  for (const product of products) {
    const allowed = new Set((await optionsForProduct(product.id)).map((opt) => String(opt.id)));
    const optionIds = [...new Set((byProduct.get(String(product.id)) || []).map((id) => String(id)).filter((id) => allowed.has(id)))];
    if (optionIds.length) stoodOut.push({ product_id: product.id, option_ids: optionIds });
  }
  return stoodOut;
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const postId = body?.post_id;
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    const contentType = normalizeCommunityContentType(body?.content_type);
    const takeaways = (Array.isArray(body?.key_takeaways) ? body.key_takeaways : []).map((row) => String(row || "").trim()).filter(Boolean).slice(0, 12);
    if (!postId) return NextResponse.json({ error: "post_id is required." }, { status: 400 });
    if (title.length < 3) return NextResponse.json({ error: "Add a title." }, { status: 400 });
    if (text.length < 8 && !takeaways.length) return NextResponse.json({ error: "Add a short post or at least one key takeaway." }, { status: 400 });
    const screened = screenKolText({ title, body: `${text}\n${takeaways.join("\n")}` });
    if (!screened.ok) return NextResponse.json({ error: screened.message, reasons: screened.reasons }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin.from("shop_kol_posts").select("id, author_profile_id, source_type, status, primary_product_id").eq("id", postId).maybeSingle();
    if (!post || post.author_profile_id !== profile.id || post.source_type !== "community" || post.status !== "draft") return NextResponse.json({ error: "Community draft not found." }, { status: 404 });

    const productIds = Array.isArray(body?.products) ? body.products.map((row) => row.id).filter(Boolean) : [];
    const products = await assertCommunityProducts(profile.id, productIds.length ? productIds : [post.primary_product_id], body?.brand_id || "");
    const { data: media } = await admin.from("shop_kol_post_media").select("id, resource_type").eq("post_id", post.id).eq("lifecycle", "unattached").limit(40);
    if (!(media || []).length) return NextResponse.json({ error: "Add at least one photo or video first." }, { status: 400 });
    const videos = (media || []).filter((row) => row.resource_type === "video");
    if (videos.length > 1) return NextResponse.json({ error: "Only one video can be uploaded." }, { status: 400 });

    const stoodOut = await stoodOutForPost(products, body);
    const { data: lastRevision } = await admin.from("shop_kol_post_revisions").select("revision_number").eq("post_id", post.id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
    const now = new Date().toISOString();
    const revisionNumber = Number(lastRevision?.revision_number || 0) + 1;
    const baseRevision = { post_id: post.id, revision_number: revisionNumber, title, body: text, rating: null, content_type: contentType, key_takeaways: takeaways, moderation_status: "pending", moderation_reasons: [], submitted_at: now };
    let { data: revision, error: revisionErr } = await admin.from("shop_kol_post_revisions").insert({ ...baseRevision, stood_out: stoodOut }).select("id").single();
    if (revisionErr) {
      ({ data: revision, error: revisionErr } = await admin.from("shop_kol_post_revisions").insert(baseRevision).select("id").single());
    }
    if (revisionErr) throw revisionErr;

    const extrasById = Object.fromEntries((Array.isArray(body?.products) ? body.products : []).filter((row) => row?.id).map((row) => [row.id, row]));
    await linkCommunityProducts(admin, post.id, products, extrasById);

    const { data: tags } = await admin.from("shop_product_tags").select("tag_id").in("product_id", products.map((row) => row.id));
    if ((tags || []).length) {
      const unique = [...new Map((tags || []).map((row) => [row.tag_id, { post_id: post.id, tag_id: row.tag_id }])).values()];
      const { error: tagErr } = await admin.from("shop_kol_post_tags").upsert(unique, { onConflict: "post_id,tag_id" });
      if (tagErr) throw tagErr;
    }

    const meta = Array.isArray(body?.media) ? body.media : [];
    const hasVideo = videos.length > 0;
    for (const row of media || []) {
      const extra = meta.find((item) => item.id === row.id) || {};
      const { error: mediaErr } = await admin.from("shop_kol_post_media").update({
        revision_id: revision.id,
        lifecycle: "attached_private",
        caption: String(extra.caption || "").trim(),
        is_cover: hasVideo ? row.resource_type === "video" : extra.is_cover === true,
        product_id: extra.product_id || null,
        sort_order: Number(extra.sort_order || 0),
      }).eq("id", row.id).eq("post_id", post.id);
      if (mediaErr) throw mediaErr;
    }
    await admin.from("kol_upload_sessions").update({ status: "attached", attached_at: now }).eq("post_id", post.id).eq("status", "uploaded");
    const { error: postErr } = await admin.from("shop_kol_posts").update({ pending_revision_id: revision.id, content_type: contentType, primary_product_id: products[0].id, status: "pending_admin", updated_at: now }).eq("id", post.id).eq("status", "draft");
    if (postErr) throw postErr;
    await admin.from("kol_moderation_events").insert({ post_id: post.id, revision_id: revision.id, stage: "deterministic_text", decision: "pending_admin", reasons: [] });
    return NextResponse.json({ ok: true, post_id: post.id, status: "pending_admin" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not submit the community post." }, { status: 400 });
  }
}
