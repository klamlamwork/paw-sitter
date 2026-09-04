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
    const itemId = body?.order_item_id;
    if (!itemId) return NextResponse.json({ error: "order_item_id is required." }, { status: 400 });

    const access = await canRateItem(itemId, profile);
    if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 400 });

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("shop_kol_posts")
      .select("id, status")
      .eq("author_profile_id", profile.id)
      .eq("source_type", "verified_purchase")
      .eq("verified_order_item_id", itemId)
      .in("status", ["draft", "processing", "pending_admin", "published"])
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, post_id: existing.id, status: existing.status });

    const { data: post, error } = await admin
      .from("shop_kol_posts")
      .insert({
        author_profile_id: profile.id,
        source_type: "verified_purchase",
        content_type: "review",
        status: "draft",
        verified_order_item_id: itemId,
        primary_product_id: access.item.product_id,
        verified_badge: false,
      })
      .select("id, status")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, post_id: post.id, status: post.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start the verified media draft." }, { status: 400 });
  }
}
