import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requestReviewsForCompletedBookings } from "@/lib/reviews";

export const dynamic = "force-dynamic";

async function run() {
  const result = await requestReviewsForCompletedBookings();
  return NextResponse.json(result);
}

export async function GET(request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await run();
  } catch (err) {
    return NextResponse.json({ error: err.message || "Review request failed" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const profile = await requireRole("admin");
    if (!profile) return NextResponse.json({ error: "Sign in as admin." }, { status: 401 });
    return await run();
  } catch (err) {
    return NextResponse.json({ error: err.message || "Review request failed" }, { status: 500 });
  }
}
