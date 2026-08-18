import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const admin = await requireRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const db = createAdminClient();
  if (body.settings) {
    const { error } = await db.from("paw_point_settings").update({ ...body.settings, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (const rate of body.rates || []) {
    const { error } = await db.from("paw_point_earn_rates").update({
      points_per_dollar: Number(rate.points_per_dollar) || 0,
      flat_points: Number(rate.flat_points) || 0,
      updated_at: new Date().toISOString(),
    }).eq("source_key", rate.source_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
