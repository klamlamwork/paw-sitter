import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { canRateItem } from "@/lib/shopRatings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ownedDraft(admin, profileId, itemId) {
  const { data: post } = await admin
    .from("shop_kol_posts")
    .select("id, status, pending_revision_id, created_at")
    .eq("author_profile_id", profileId)
    .eq("source_type", "verified_purchase")
    .eq("verified_order_item_id", itemId)
    .in("status", ["draft", "processing", "pending_admin", "needs_changes", "published"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!post) return null;
  const { count } = await admin
    .from("shop_kol_post_media")
    .select("id", { count: "exact", head: true })
    .eq("post_id", post.id)
    .in("lifecycle", ["unattached", "attached_private", "published"]);
  return { ...post, media_count: count || 0 };
}

export async function GET(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const itemId = new URL(request.url).searchParams.get("order_item_id") || "";
    if (!itemId) return NextResponse.json({ error: "order_item_id is required." }, { status: 400 });
    const access = await canRateItem(itemId, profile, { allowExistingReview: true });
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 400 });
    const draft = await ownedDraft(createAdminClient(), profile.id, itemId);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load media draft." }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const itemId = body?.order_item_id;
    if (!itemId) return NextResponse.json({ error: "order_item_id is required." }, { status: 400 });
    const access = await canRateItem(itemId, profile, { allowExistingReview: true });
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 400 });
    const admin = createAdminClient();
    const existing = await ownedDraft(admin, profile.id, itemId);
    if (existing) return NextResponse.json({ ok: true, post_id: existing.id, status: existing.status, media_count: existing.media_count });
    const { data: post, error } = await admin
      .from("shop_kol_posts")
      .insert({ author_profile_id: profile.id, source_type: "verified_purchase", content_type: "review", status: "draft", verified_order_item_id: itemId, primary_product_id: access.item.product_id, verified_badge: false })
      .select("id, status")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, post_id: post.id, status: post.status, media_count: 0 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start the verified media draft." }, { status: 400 });
  }
}
