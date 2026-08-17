import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quoteBookingRefund } from "@/lib/refundPolicy";
import { applyBookingRefund } from "@/lib/applyBookingRefund";

export const dynamic = "force-dynamic";

const BOOKING_SELECT =
  "id, status, payment_status, payment_method, payment_received, sitter_id, service_type, customer_id, estimated_total, addon_cents, stripe_payment_intent, booked_timezone, booking_slots(starts_at, ends_at, duration_minutes, service_type)";

async function loadSitterBooking(bookingId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to cancel.", status: 401 };
  const { data: sitter } = await supabase.from("sitters").select("id").eq("profile_id", user.id).maybeSingle();
  if (!sitter) return { error: "Sitter profile not found.", status: 403 };
  const { data: booking } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", bookingId).eq("sitter_id", sitter.id).single();
  if (!booking) return { error: "Booking not found.", status: 404 };
  return { booking };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const bookingId = url.searchParams.get("booking_id");
    const waive = url.searchParams.get("waive") === "1";
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    const loaded = await loadSitterBooking(bookingId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    return NextResponse.json({
      quote: quoteBookingRefund(loaded.booking, { actor: waive ? "owner" : "sitter", waiveRemaining: waive }),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not quote refund" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const bookingId = body?.booking_id;
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    const loaded = await loadSitterBooking(bookingId);
    if (loaded.error) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    if (["canceled", "cancelled"].includes(loaded.booking.status)) {
      return NextResponse.json({ error: "This booking is already canceled." }, { status: 400 });
    }
    const waiveRemaining = !!body?.waive_remaining;
    const result = await applyBookingRefund({
      booking: loaded.booking,
      actor: waiveRemaining ? "sitter" : "sitter",
      waiveRemaining,
      reason: body?.reason || (waiveRemaining ? "Sitter waived cancellation policy" : "Sitter canceled remaining service"),
    });
    return NextResponse.json({ canceled: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not cancel booking" }, { status: 500 });
  }
}
