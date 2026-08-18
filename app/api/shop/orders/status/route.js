import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onShopOrderDelivered } from "@/lib/pawPointsHooks";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  const { error } = await supabase.from("shop_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (status === "delivered") {
    try { await onShopOrderDelivered(id); } catch (e) { console.error(e.message); }
  }
  return NextResponse.json({ ok: true });
}
