import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markKolUploaded } from "@/lib/kolUploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!body?.session_id || !body?.public_id) return NextResponse.json({ error: "session_id and public_id are required." }, { status: 400 });

    const { data: session } = await supabase
      .from("kol_upload_sessions")
      .select("id, profile_id")
      .eq("id", body.session_id)
      .maybeSingle();
    if (!session || session.profile_id !== user.id) return NextResponse.json({ error: "Upload session not found." }, { status: 404 });

    const media = await markKolUploaded(body.session_id, {
      public_id: body.public_id,
      version: body.version,
      resource_type: body.resource_type,
      bytes: body.bytes,
      width: body.width,
      height: body.height,
      duration_seconds: body.duration_seconds,
    });
    return NextResponse.json({ ok: true, media });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not attach KOL media." }, { status: 400 });
  }
}
