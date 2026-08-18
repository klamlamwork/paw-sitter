import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBookingCompleted } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const admin = createAdminClient();
    const { booking_id } = await request.json();
    if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });
    const { error } = await admin.from("bookings").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", booking_id);
    if (error) throw error;
    try { await onBookingCompleted(booking_id); } catch (e) { console.error(e.message); }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not complete booking" }, { status: 500 });
  }
}
