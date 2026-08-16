import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { reviewsForSlug, submitProductReview } from "@/lib/shopRatings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const slug = new URL(request.url).searchParams.get("slug") || "";
    const data = await reviewsForSlug(slug);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load reviews" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in to rate." }, { status: 401 });
    const body = await request.json();
    const review = await submitProductReview({
      profile,
      itemId: body.item_id,
      rating: body.rating,
      title: body.title,
      body: body.body,
      optionIds: body.option_ids || [],
    });
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not save review" }, { status: 500 });
  }
}
