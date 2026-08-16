import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const profile = await requireRole("admin");
    if (!profile) return NextResponse.json({ error: "Sign in as admin." }, { status: 401 });
    const { kind, id, status, admin_note } = await request.json();
    if (!id || ![
      "sitter",
      "pet",
    ].includes(kind) || !["published", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid review update." }, { status: 400 });
    }
    const table = kind === "sitter" ? "sitter_reviews" : "pet_reviews";
    const now = new Date().toISOString();
    const patch = {
      status,
      admin_note: admin_note || null,
      reviewed_at: now,
      published_at: status === "published" ? now : null,
    };
    const admin = createAdminClient();
    const { error } = await admin.from(table).update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not update review" }, { status: 500 });
  }
}
