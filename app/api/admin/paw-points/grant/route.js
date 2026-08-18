import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { appendLedger } from "@/lib/pawPoints";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const userIds = body.user_ids || [];
  const points = Math.floor(Number(body.points) || 0);
  const remark = (body.remark || "").trim();
  if (!userIds.length || !points || !remark) {
    return NextResponse.json({ error: "user_ids, points, and remark are required" }, { status: 400 });
  }
  const done = [];
  for (const userId of userIds) {
    const row = await appendLedger({
      user_id: userId,
      delta: points,
      status: "available",
      reason: points > 0 ? "admin_grant" : "admin_adjust",
      admin_id: admin.id,
      remark,
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    });
    done.push(row.id);
  }
  return NextResponse.json({ ok: true, entries: done });
}
