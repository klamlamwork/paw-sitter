import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toHolidayKey } from "@/lib/holidays";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin");
    const admin = createAdminClient();
    const { data, error } = await admin.from("holiday_dates").select("holiday_date, name").order("holiday_date");
    if (error) throw error;
    return NextResponse.json({ holidays: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load holidays" }, { status: err.message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request) {
  try {
    await requireRole("admin");
    const body = await request.json();
    const date = toHolidayKey(body?.date);
    const name = String(body?.name || "Holiday").trim() || "Holiday";
    if (!date) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin.from("holiday_dates").upsert({ holiday_date: date, name }, { onConflict: "holiday_date" });
    if (error) throw error;
    return NextResponse.json({ ok: true, date, name });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not save holiday" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await requireRole("admin");
    const body = await request.json();
    const date = toHolidayKey(body?.date);
    if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin.from("holiday_dates").delete().eq("holiday_date", date);
    if (error) throw error;
    return NextResponse.json({ ok: true, date });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not remove holiday" }, { status: 500 });
  }
}
