import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { missingApplicationFields } from "@/lib/sitterApplication";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const admin = createAdminClient();
    const { data: sitter, error } = await admin
      .from("sitters")
      .select("*, sitter_services(*), sitter_weekly_availability(*)")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!sitter) return NextResponse.json({ error: "Start your application from the dashboard first." }, { status: 404 });
    if (sitter.application_status === "approved") {
      return NextResponse.json({ ok: true, status: "approved" });
    }

    const missing = missingApplicationFields(sitter);
    if (missing.length) {
      return NextResponse.json(
        { error: "Please save the dashboard first. Still missing: " + missing.join(", ") },
        { status: 400 }
      );
    }

    const { error: uErr } = await admin
      .from("sitters")
      .update({
        application_status: "submitted",
        submitted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq("id", sitter.id);
    if (uErr) throw uErr;
    return NextResponse.json({ ok: true, status: "submitted" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Submit failed" }, { status: 500 });
  }
}
