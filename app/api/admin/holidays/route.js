import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toHolidayKey } from "@/lib/holidays";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("holiday_dates").select("holiday_date, name").order("holiday_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holidays: data || [] });
}

export async function POST(request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const date = toHolidayKey(body?.date);
  const name = String(body?.name || "Holiday").trim() || "Holiday";
  if (!date) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("holiday_dates").upsert({ holiday_date: date, name }, { onConflict: "holiday_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, date, name });
}

export async function DELETE(request) {
  const profile = await requireRole("admin");
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const date = toHolidayKey(body?.date);
  if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("holiday_dates").delete().eq("holiday_date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, date });
}
