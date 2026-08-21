import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import {
  REFERRAL_MONTHLY_CAP,
  REFERRAL_POINTS,
  attachReferralFromCookies,
  ensureReferralCode,
  listReferralActivity,
  monthReferralEarned,
  referralLink,
} from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
  await attachReferralFromCookies(profile);
  const code = await ensureReferralCode(profile.id);
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://paw-sitter.vercel.app";
  const monthPts = await monthReferralEarned(profile.id);
  const activity = await listReferralActivity(profile.id);
  const earned = activity
    .filter((r) => r.status === "rewarded")
    .reduce((s) => s + REFERRAL_POINTS, 0);
  return NextResponse.json({
    code,
    link: referralLink(code, origin),
    points: REFERRAL_POINTS,
    month_earned: monthPts,
    month_cap: REFERRAL_MONTHLY_CAP,
    total_earned: earned,
    activity,
  });
}
