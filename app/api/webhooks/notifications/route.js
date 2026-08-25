import { NextResponse } from "next/server";
import { notifyBookingChange, notifyOrderChange } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request) {
  const secret = (process.env.NOTIFICATION_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await request.json();
    const table = payload.table || payload.record?.table || "";
    const type = payload.type || payload.eventType || "";
    const record = payload.record || payload.new || payload.row || null;
    const oldRecord = payload.old_record || payload.old || null;

    if (table === "shop_orders" || record?.seller_shop_id) {
      return NextResponse.json(await notifyOrderChange({ record, oldRecord, type }));
    }
    if (table === "bookings" || record?.service_type) {
      return NextResponse.json(await notifyBookingChange({ record, oldRecord, type }));
    }
    return NextResponse.json({ skipped: true, reason: "unhandled table" });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Notification webhook failed" }, { status: 500 });
  }
}
