import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const admin = createAdminClient();
    const { order_id } = await request.json();
    if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });
    const { error } = await admin.from("shop_orders").update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not mark order delivered" }, { status: 500 });
  }
}
