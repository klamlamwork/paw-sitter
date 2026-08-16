import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { saveSitterPaymentSettings } from "@/lib/sitterPayments";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const profile = await requireRole("admin");
    if (!profile) return NextResponse.json({ error: "Sign in as admin to change payment methods." }, { status: 401 });

    const body = await request.json();
    const settings = await saveSitterPaymentSettings({
      card_enabled: !!body.card_enabled,
      etransfer_enabled: !!body.etransfer_enabled,
      pay_later_enabled: !!body.pay_later_enabled,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not save payment settings" }, { status: 500 });
  }
}
