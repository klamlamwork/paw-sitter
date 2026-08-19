import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { conversationIdForBooking } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
    const body = await request.json();
    const bookingId = body?.booking_id;
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    const conversationId = await conversationIdForBooking(bookingId, profile);
    if (!conversationId) return NextResponse.json({ error: "Could not open inbox." }, { status: 404 });
    return NextResponse.json({ ok: true, conversation_id: conversationId });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not start inbox" }, { status: 500 });
  }
}
