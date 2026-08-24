import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const e164 = String(body?.phone_e164 || "").trim();
    const country = String(body?.phone_country_code || "").replace(/\D/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("sitters")
      .update({
        phone: e164,
        phone_e164: e164,
        phone_country_code: country,
        phone_verified_at: now,
      })
      .eq("profile_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No sitter application found." }, { status: 404 });
    return NextResponse.json({ ok: true, phone_e164: e164 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Verify failed" }, { status: 500 });
  }
}
