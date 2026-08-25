import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearUserShopCart, releaseReservedPoints } from "@/lib/pawPointsRelease";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const canceled = !!body.canceled;
  const paid = !!body.paid;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data: recentPaid } = await admin
    .from("shop_orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .gte("paid_at", since);

  if (paid || (recentPaid || []).length) {
    await clearUserShopCart(admin, { userId: user.id });
  }

  if (canceled) {
    const { data: pending } = await admin
      .from("shop_orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("payment_method", "card")
      .in("payment_status", ["pending", "unpaid"])
      .not("stripe_session_id", "is", null);
    let released = 0;
    for (const order of pending || []) {
      const out = await releaseReservedPoints({ userId: user.id, orderId: order.id });
      released += out.released || 0;
    }
    return NextResponse.json({ ok: true, cleared: !!(paid || (recentPaid || []).length), released });
  }

  return NextResponse.json({ ok: true, cleared: !!(paid || (recentPaid || []).length) });
}
