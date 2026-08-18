import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBookingPaid } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { booking_id } = await request.json();
  if (!booking_id) return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  const { data: booking } = await supabase.from("bookings").select("id, payment_status, payment_received").eq("id", booking_id).eq("customer_id", user.id).maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.payment_received || booking.payment_status === "paid") return NextResponse.json({ ok: true, already: true });
  const admin = createAdminClient();
  const { error } = await admin.from("bookings").update({
    payment_method: "card",
    payment_status: "paid",
    payment_received: true,
    payment_received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", booking_id).eq("customer_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try { await onBookingPaid(booking_id); } catch (e) { console.error(e.message); }
  return NextResponse.json({ ok: true });
}
