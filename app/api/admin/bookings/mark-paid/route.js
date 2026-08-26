import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBookingPaid } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const adminProfile = await requireRole("admin");
    if (!adminProfile) return NextResponse.json({ error: "Admin only." }, { status: 401 });

    const { booking_id } = await request.json();
    if (!booking_id) return NextResponse.json({ error: "booking_id is required." }, { status: 400 });

    const admin = createAdminClient();
    const { data: booking, error: loadError } = await admin
      .from("bookings")
      .select("id, payment_method, payment_status, payment_received")
      .eq("id", booking_id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (booking.payment_method !== "etransfer") {
      return NextResponse.json({ error: "Only e-transfer bookings can be marked paid manually. Stripe payments are confirmed automatically." }, { status: 400 });
    }
    if (booking.payment_status === "paid" || booking.payment_received) {
      return NextResponse.json({ ok: true, already_paid: true });
    }

    const { error: updateError } = await admin
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_received: true,
        payment_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
    if (updateError) throw updateError;

    try { await onBookingPaid(booking.id); } catch (err) { console.error(err.message); }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not mark e-transfer paid." }, { status: 500 });
  }
}
