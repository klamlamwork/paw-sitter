import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/pawPoints";
import { getProfile } from "@/lib/auth";
import ReferralInviteCard from "../ReferralInviteCard";
import { REFERRAL_MONTHLY_CAP, attachReferralFromCookies, listReferralActivity, monthReferralEarned } from "@/lib/referrals";
import { groupPawPointActivity } from "@/lib/pawPointActivity";

export const metadata = { title: "Paw Points | Paw Sitter" };

function pointClass(points) {
  return points < 0 ? "text-red-700" : "text-green-700";
}

export default async function AccountPawPointsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account/paw-points");
  await attachReferralFromCookies(profile);

  const supabase = await createClient();
  const balance = await getBalance(profile.id);
  const monthPts = await monthReferralEarned(profile.id);
  const activity = await listReferralActivity(profile.id);
  const { data: rows } = await supabase
    .from("paw_point_ledger")
    .select("id, delta, status, reason, remark, lot_id, created_at, order_id, booking_id")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(250);
  const grouped = groupPawPointActivity(rows || []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Paw Points</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">500 points = $1.00. Points are available after delivery or a completed service.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
          <p className="text-xs text-[#7a5c4e]">Available</p>
          <p className="text-2xl font-bold text-[#3b2a22]">{Math.max(0, balance.available)}</p>
          <p className="mt-1 text-xs text-[#7a5c4e]">Ready to use at checkout</p>
        </div>
        <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
          <p className="text-xs text-[#7a5c4e]">Pending</p>
          <p className="text-2xl font-bold text-[#3b2a22]">{Math.max(0, balance.pending)}</p>
          <p className="mt-1 text-xs text-[#7a5c4e]">Available after fulfillment</p>
        </div>
      </div>

      <ReferralInviteCard />

      <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Referral rewards</h2>
        <p className="mt-1 text-sm text-[#7a5c4e]">This month: {monthPts} / {REFERRAL_MONTHLY_CAP} points. Extra rewards roll to next month.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {activity.length ? activity.map((row) => (
            <li key={row.id} className="rounded-xl bg-[#fff8f0] px-3 py-2">{row.line}</li>
          )) : <li className="text-[#7a5c4e]">No referrals yet.</li>}
        </ul>
      </div>

      <h2 className="mt-8 text-xl font-semibold text-[#3b2a22]">Activity</h2>
      <p className="mt-1 text-sm text-[#7a5c4e]">Each checkout or earning is shown once, even when internal FIFO accounting uses multiple point lots.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {grouped.length ? grouped.map((row) => (
          <li key={row.id} className="rounded-xl border border-[#e8d5c4] bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#3b2a22]">{row.label}</p>
                {row.detail ? <p className="mt-0.5 text-xs text-[#7a5c4e]">{row.detail}</p> : null}
                <p className="mt-1 text-xs text-[#7a5c4e]">{row.status} · {new Date(row.created_at).toLocaleString()}</p>
              </div>
              <span className={`font-semibold ${pointClass(row.signedPoints)}`}>
                {row.signedPoints > 0 ? "+" : ""}{row.signedPoints}
              </span>
            </div>
          </li>
        )) : <li className="text-[#7a5c4e]">No Paw Points activity yet.</li>}
      </ul>
    </div>
  );
}
