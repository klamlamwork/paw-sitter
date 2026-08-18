import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { expireInactive } from "@/lib/pawPoints";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ok = (secret && auth === `Bearer ${secret}`) || !!(await requireRole("admin").catch(() => null));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expired = await expireInactive();
  return NextResponse.json({ expired_users: expired });
}
