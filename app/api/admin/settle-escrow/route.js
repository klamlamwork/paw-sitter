import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { runEscrowSettlement } from "@/lib/escrow";

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

export async function GET(request) {
  if (!(await authorize(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payOut = new URL(request.url).searchParams.get("payout") === "1";
    const result = await runEscrowSettlement({ payOut });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Settlement failed" }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
