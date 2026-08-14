import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  const now = Date.now();
  const start = new Date(startsAtISO).getTime();
  return (start - now) / (1000 * 60 * 60);
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, status, payment_status, booking_slots(starts_at)")
      .in("status", ["accepted", "pending"])
      .in("payment_status", ["pending", "requires_payment"]);

    const toCancel = [];
    for (const b of bookings || []) {
      const firstSlot = (b.booking_slots || [])[0];
      const startsAtISO = firstSlot?.starts_at;
      const hours = hoursUntilUTC(startsAtISO);
      if (hours !== null && hours < 48) {
        toCancel.push(b.id);
      }
    }

    if (toCancel.length) {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "canceled", payment_status: "canceled", updated_at: new Date().toISOString() })
        .in("id", toCancel);
      if (error) throw error;
    }

    return NextResponse.json({ canceled: toCancel });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Auto-cancel failed" }, { status: 500 });
  }
}
