import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyShopItemRefund } from "@/lib/shopItemRefund";
import { reconcileVerifiedKolForRefundedItem } from "@/lib/kolRefundReconciliation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const orderItemId = body?.orderItemId;
    const qty = body?.qty;
    if (!orderItemId) return NextResponse.json({ error: "orderItemId is required." }, { status: 400 });
    const result = await applyShopItemRefund({ orderItemId, sellerUserId: user.id, qty });
    try { await reconcileVerifiedKolForRefundedItem(orderItemId); } catch (err) { console.error(err.message); }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not refund item." }, { status: 400 });
  }
}
