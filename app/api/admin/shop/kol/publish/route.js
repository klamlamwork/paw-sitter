import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { publishKolPost } from "@/lib/kolPublish";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const adminProfile = await requireRole("admin");
    if (!adminProfile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const result = await publishKolPost({ postId: body?.post_id, adminProfileId: adminProfile.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not publish this KOL post." }, { status: 400 });
  }
}
