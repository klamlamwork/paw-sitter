import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quoteShopCode, quoteBookingCode, publicCode } from "@/lib/discounts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const raw = body?.code;
    const context = body?.context || "shop";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in to use promos." }, { status: 401 });

    if (context === "shop") {
      const items = body?.items || [];
      const shippingCents = Number(body?.shippingCents) || 0;
      const result = await quoteShopCode(raw, user.id, items);
      if (!result.ok) return NextResponse.json({ error: result.reason, debug: result.debug }, { status: 400 });
      return NextResponse.json({ code: publicCode(result.code, result.quote), discount_cents: result.quote.discountCents, funded_by_platform: result.quote.fundedByPlatform });
    }

    if (context === "booking") {
      const booking = body?.booking;
      if (!booking) return NextResponse.json({ error: "Missing booking." }, { status: 400 });
      const result = await quoteBookingCode(raw, user, booking);
      if (!result.ok) return NextResponse.json({ error: result.reason, debug: result.debug }, { status: 400 });
      return NextResponse.json({ code: publicCode(result.code, result.quote), discount_cents: result.quote.discountCents, funded_by_platform: result.quote.fundedByPlatform });
    }

    return NextResponse.json({ error: "Invalid context." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not apply promo" }, { status: 500 });
  }
}
