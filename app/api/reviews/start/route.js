import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { reviewButtonState } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to review." }, { status: 401 });
    const bookingId = new URL(request.url).searchParams.get("booking_id");
    if (!bookingId) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });
    const state = await reviewButtonState(bookingId, profile);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load review" }, { status: 500 });
  }
}
