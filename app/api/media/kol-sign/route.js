import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createKolUploadSession } from "@/lib/kolUploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sign(params, secret) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(base + secret).digest("hex");
}

export async function POST(request) {
  try {
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloudinary is not configured." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await request.json();
    const mediaKind = body?.media_kind === "video" ? "video" : "image";
    const session = await createKolUploadSession({
      userId: user.id,
      mediaKind,
      postId: body?.post_id || null,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      folder: session.folder,
      public_id: session.public_id,
      timestamp,
    };
    return NextResponse.json({
      session_id: session.id,
      cloud_name: cloudName,
      api_key: apiKey,
      timestamp,
      folder: session.folder,
      public_id: session.public_id,
      resource_type: session.resource_type,
      max_bytes: session.max_bytes,
      max_duration_seconds: session.max_duration_seconds,
      expires_at: session.expires_at,
      signature: sign(params, apiSecret),
      upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/${session.resource_type}/upload`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not sign KOL upload." }, { status: 500 });
  }
}
