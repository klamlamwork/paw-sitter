import { NextResponse } from "next/server";
import { cleanupOrphanKolUploads } from "@/lib/kolUploads";
import { releaseDueKolRewards } from "@/lib/kolRewards";
import { releaseDueShopOrderEarns } from "@/lib/shopOrderEarnHold";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orphans = await cleanupOrphanKolUploads();
    const released = await releaseDueKolRewards();
    let shop = { released: [], restored: [] };
    try {
      shop = await releaseDueShopOrderEarns();
    } catch (err) {
      console.error(err.message);
    }
    return NextResponse.json({ ok: true, orphans: orphans.length, released: released.length, shop });
  } catch (err) {
    return NextResponse.json({ error: err.message || "KOL maintenance failed" }, { status: 500 });
  }
}
