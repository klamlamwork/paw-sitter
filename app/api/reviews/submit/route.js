import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInviteByToken, loadReviewContext } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const found = await getInviteByToken(body.token);
    if (!found) return NextResponse.json({ error: "This review link is invalid." }, { status: 404 });
    const ctx = await loadReviewContext(found.invite, found.role);
    if (!ctx) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const admin = createAdminClient();
    if (found.role === "customer") {
      const rating = Number(body.rating);
      const text = String(body.body || "").trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Choose 1 to 5 stars." }, { status: 400 });
      if (text.length < 8) return NextResponse.json({ error: "Please write a short review." }, { status: 400 });
      if (ctx.sitterReview) return NextResponse.json({ error: "You already submitted this review." }, { status: 409 });
      const { error } = await admin.from("sitter_reviews").insert({
        booking_id: ctx.booking.id,
        invite_id: found.invite.id,
        sitter_id: ctx.booking.sitter_id,
        customer_id: ctx.booking.customer_id,
        rating,
        body: text,
        status: "pending",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const items = Array.isArray(body.pets) ? body.pets : [];
    const allowed = new Set(ctx.pets.map((p) => p.id));
    const already = new Set(ctx.petReviews.map((r) => r.pet_id));
    const rows = [];
    for (const item of items) {
      if (!allowed.has(item.pet_id) || already.has(item.pet_id)) continue;
      const text = String(item.body || "").trim();
      if (!text) continue;
      if (text.length < 8) return NextResponse.json({ error: "Please write a short note for each pet." }, { status: 400 });
      rows.push({
        booking_id: ctx.booking.id,
        invite_id: found.invite.id,
        pet_id: item.pet_id,
        sitter_id: ctx.booking.sitter_id,
        body: text,
        status: "pending",
      });
    }
    if (!rows.length) return NextResponse.json({ error: "Add a written review for at least one pet." }, { status: 400 });
    const { error } = await admin.from("pet_reviews").insert(rows);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not submit review" }, { status: 500 });
  }
}
