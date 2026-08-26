import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseReservedPoints } from "@/lib/pawPointsRelease";

export const dynamic = "force-dynamic";

// This route is deliberately cancellation-only. Cart deletion is performed
// only by the verified Stripe checkout.session.completed webhook.
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.canceled) return NextResponse.json({ ok: true, cleared: false });

  const admin = createAdminClient();
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

  return NextResponse.json({ ok: true, cleared: false, released });
}
