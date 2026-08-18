import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { appendLedger, loadPointConfig } from "@/lib/pawPoints";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const userId = body.user_id;
  const sourceKey = body.source_key === "kol_guide" ? "kol_guide" : "kol_review";
  const remark = (body.remark || `KOL ${sourceKey}`).trim();
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const { rates } = await loadPointConfig();
  const points = Math.floor(Number(body.points) || rates[sourceKey]?.flat_points || 0);
  if (points <= 0) return NextResponse.json({ error: "Set flat points for this KOL type first." }, { status: 400 });
  const row = await appendLedger({
    user_id: userId,
    delta: points,
    status: "available",
    reason: "earn_kol",
    source_key: sourceKey,
    admin_id: admin.id,
    remark,
    expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  });
  return NextResponse.json({ ok: true, id: row.id, points });
}
