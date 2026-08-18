import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clampRedeem, earnPointsForItems, getBalance, loadPointConfig, pointsFromCents } from "@/lib/pawPoints";

export const dynamic = "force-dynamic";

function scaleItemsToCash(items, cashCents) {
  const gross = (items || []).reduce((sum, item) => sum + (Number(item.net_cents ?? item.price_cents) || 0) * (item.qty || 1), 0);
  if (!items?.length || gross <= 0) return [{ net_cents: cashCents, qty: 1, product_type: "other" }];
  return items.map((item) => ({
    ...item,
    qty: 1,
    net_cents: Math.floor((((Number(item.net_cents ?? item.price_cents) || 0) * (item.qty || 1)) / gross) * cashCents),
  }));
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const body = await request.json();
  const orderCents = Math.max(0, Number(body.order_cents) || 0);
  const want = Math.floor(Number(body.points) || 0);
  const { rates, settings } = await loadPointConfig();
  const balance = await getBalance(user.id);
  const redeem = want ? clampRedeem(want, balance.available, orderCents) : { ok: true, points: 0, cents: 0 };
  const cashCents = Math.max(0, orderCents - (redeem.cents || 0));
  const sourceKey = body.source_key || "other";
  let earn = 0;
  if (sourceKey === "sitter_booking") {
    earn = pointsFromCents(cashCents, rates.sitter_booking?.points_per_dollar ?? settings.booking_points_per_dollar ?? 5);
  } else {
    earn = earnPointsForItems(scaleItemsToCash(body.items || [], cashCents), rates, settings.default_product_points_per_dollar);
  }
  return NextResponse.json({
    balance,
    redeem,
    earn_points: earn,
    cash_cents: cashCents,
    settings: {
      min: settings.min_redeem_points,
      max_pct: settings.max_redeem_pct,
      cents_per_point: settings.cents_per_point,
    },
  });
}
