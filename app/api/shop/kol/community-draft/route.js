import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCommunityProducts, ownedCommunityDraft, normalizeCommunityContentType, linkCommunityProducts } from "@/lib/kolCommunity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const draft = await ownedCommunityDraft(createAdminClient(), profile.id);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load community draft." }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const productIds = Array.isArray(body?.product_ids) ? body.product_ids : (body?.product_id ? [body.product_id] : []);
    const products = await assertCommunityProducts(profile.id, productIds, body?.brand_id || "");
    const contentType = normalizeCommunityContentType(body?.content_type);
    const admin = createAdminClient();
    const existing = await ownedCommunityDraft(admin, profile.id);
    const primary = products[0];
    const now = new Date().toISOString();
    let postId = existing?.id;
    let status = existing?.status || "draft";
    if (existing) {
      const { error } = await admin.from("shop_kol_posts").update({ primary_product_id: primary.id, content_type: contentType, updated_at: now }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { data: post, error } = await admin.from("shop_kol_posts").insert({ author_profile_id: profile.id, source_type: "community", content_type: contentType, status: "draft", primary_product_id: primary.id, verified_badge: false }).select("id, status").single();
      if (error) throw error;
      postId = post.id;
      status = post.status;
    }
    await linkCommunityProducts(admin, postId, products);
    const draft = await ownedCommunityDraft(admin, profile.id);
    return NextResponse.json({ ok: true, post_id: postId, status, media_count: draft?.media_count || 0, products: draft?.products || products, media: draft?.media || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start the community draft." }, { status: 400 });
  }
}
