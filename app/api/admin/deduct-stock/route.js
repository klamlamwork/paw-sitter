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
    return !!(await requireRole("admin"));
  } catch {
    return false;
  }
}

export async function GET(request) {
  return POST(request);
}

export async function POST(request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  // Deduct for all paid orders that haven't been deducted yet
  const { data: orders, error } = await admin
    .from("shop_orders")
    .select("id, payment_status")
    .eq("payment_status", "paid");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const done = [];
  const notes = [];
  for (const o of orders || []) {
    try {
      const result = await deductShopOrderStock(o.id);
      if (!result.skipped) done.push(o.id);
      else notes.push(`${o.id}: already deducted`);
    } catch (err) {
      notes.push(`${o.id}: ${err.message}`);
    }
  }
  return NextResponse.json({ deducted: done, notes });
}
