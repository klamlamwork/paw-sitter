import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onBookingCompleted } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id, status } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const next = status || "completed";
  const { error } = await supabase.from("bookings").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (next === "completed" || next === "complete") {
    try { await onBookingCompleted(id); } catch (e) { console.error(e.message); }
  }
  return NextResponse.json({ ok: true });
}
