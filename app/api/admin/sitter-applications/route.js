import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sitters")
    .select("id, display_name, invite_email, application_status, phone_e164, phone_verified_at, service_city, service_country, is_active, applied_at, submitted_at")
    .in("application_status", ["pending", "submitted", "rejected"])
    .order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sitters: data || [] });
}

export async function POST(request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const body = await request.json();
  const id = body?.id;
  const action = body?.action;
  if (!id || ![
    "approve",
    "reject",
  ].includes(action)) {
    return NextResponse.json({ error: "id and action required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sitter, error: sErr } = await admin.from("sitters").select("id, profile_id").eq("id", id).single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  if (action === "approve") {
    const { error } = await admin.from("sitters").update({
      application_status: "approved",
      is_active: true,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (sitter.profile_id) {
      await admin.from("profiles").update({ role: "sitter" }).eq("id", sitter.profile_id);
    }
    return NextResponse.json({ ok: true, status: "approved" });
  }

  const { error } = await admin.from("sitters").update({
    application_status: "rejected",
    is_active: false,
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: "rejected" });
}
