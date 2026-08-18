import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clampRedeem, getBalance, loadPointConfig, earnPointsForItems, pointsFromCents } from "@/lib/pawPoints";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const body = await request.json();
  const orderCents = Math.max(0, Number(body.order_cents) || 0);
  const want = Math.floor(Number(body.points) || 0);
  const items = body.items || [];
  const { rates, settings } = await loadPointConfig();
  const balance = await getBalance(user.id);
  const redeem = want ? clampRedeem(want, balance.available, orderCents) : { ok: true, points: 0, cents: 0 };
  const cashCents = Math.max(0, orderCents - (redeem.cents || 0));
  const earnItems = (items.length ? items : [{ net_cents: cashCents, qty: 1, product_type: body.source_key || "other" }]).map((it) => ({
    ...it,
    net_cents: it.net_cents ?? it.price_cents,
  }));
  const earn = earnPointsForItems(earnItems, rates, settings.default_product_points_per_dollar);
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
