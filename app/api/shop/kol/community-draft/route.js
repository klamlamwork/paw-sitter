import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCommunityProductAccess, ownedCommunityDraft, normalizeCommunityContentType } from "@/lib/kolCommunity";

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
    const product = await assertCommunityProductAccess(profile.id, body?.product_id);
    const contentType = normalizeCommunityContentType(body?.content_type);
    const admin = createAdminClient();
    const existing = await ownedCommunityDraft(admin, profile.id);
    if (existing) {
      const { error } = await admin.from("shop_kol_posts").update({ primary_product_id: product.id, content_type: contentType, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, post_id: existing.id, status: existing.status, media_count: existing.media_count, product: { id: product.id, name: product.name, slug: product.slug } });
    }
    const { data: post, error } = await admin.from("shop_kol_posts").insert({
      author_profile_id: profile.id,
      source_type: "community",
      content_type: contentType,
      status: "draft",
      primary_product_id: product.id,
      verified_badge: false,
    }).select("id, status").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, post_id: post.id, status: post.status, media_count: 0, product: { id: product.id, name: product.name, slug: product.slug } });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start the community draft." }, { status: 400 });
  }
}
