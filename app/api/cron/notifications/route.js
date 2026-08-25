import { NextResponse } from "next/server";
import { runScheduledNotifications } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request) {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const q = new URL(request.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || q === secret;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runScheduledNotifications());
  } catch (err) {
    return NextResponse.json({ error: err.message || "Cron failed" }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
