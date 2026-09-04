import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const adminProfile = await requireRole("admin");
    if (!adminProfile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const postId = body?.post_id;
    const reason = String(body?.reason || "").trim();
    if (!postId || reason.length < 5) return NextResponse.json({ error: "Enter a reason of at least 5 characters." }, { status: 400 });

    const admin = createAdminClient();
    const { data: post } = await admin
      .from("shop_kol_posts")
      .select("id, author_profile_id, status, pending_revision_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post || post.status !== "pending_admin" || !post.pending_revision_id) return NextResponse.json({ error: "This KOL post is not awaiting review." }, { status: 400 });

    const now = new Date().toISOString();
    const { error: revisionErr } = await admin
      .from("shop_kol_post_revisions")
      .update({ moderation_status: "rejected_admin", reviewed_at: now, reviewed_by: adminProfile.id, admin_note: reason })
      .eq("id", post.pending_revision_id)
      .eq("post_id", post.id)
      .eq("moderation_status", "pending");
    if (revisionErr) throw revisionErr;

    const { error: postErr } = await admin
      .from("shop_kol_posts")
      .update({ status: "needs_changes", updated_at: now })
      .eq("id", post.id)
      .eq("status", "pending_admin");
    if (postErr) throw postErr;

    const { error: eventErr } = await admin.from("kol_moderation_events").insert({
      post_id: post.id,
      revision_id: post.pending_revision_id,
      stage: "admin_review",
      decision: "needs_changes",
      reasons: [reason],
    });
    if (eventErr) throw eventErr;
    return NextResponse.json({ ok: true, status: "needs_changes" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not request changes." }, { status: 400 });
  }
}
