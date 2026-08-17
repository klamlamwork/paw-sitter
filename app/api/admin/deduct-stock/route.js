import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductShopOrderStock } from "@/lib/shopInventory";

export const dynamic = "force-dynamic";

async function authorize(request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret && auth === `Bearer ${secret}`) return true;
  try {
    const profile = await requireRole("admin");
    return !!profile;
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("shop_orders")
    .select("id, status, payment_status")
    .eq("payment_status", "paid")
    .eq("status", "pending");
  const done = [];
  const notes = [];
  for (const o of orders || []) {
    try {
      await deductShopOrderStock(o.id);
      await admin.from("shop_orders").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", o.id);
      done.push(o.id);
    } catch (err) {
      notes.push(`${o.id}: ${err.message}`);
    }
  }
  return NextResponse.json({ deducted: done, notes });
}
