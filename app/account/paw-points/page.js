import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBalance } from "@/lib/pawPoints";

export const metadata = { title: "Paw Points | Paw Sitter" };

const LABELS = {
  earn_order: "Earnings - Shop order",
  earn_booking: "Earnings - Service booking",
  earn_kol: "Earnings - KOL",
  redeem: "Redeemed at checkout",
  admin_grant: "Admin grant",
  admin_adjust: "Admin adjustment",
  expire: "Expired",
  clawback: "Clawback",
  cash_offset: "Refund offset",
  activate: "Moved to available",
};

export default async function AccountPawPointsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/paw-points");
  const balance = await getBalance(user.id);
  const { data: rows } = await supabase
    .from("paw_point_ledger")
    .select("id, delta, status, reason, remark, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Paw Points</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">500 points = $1.00. Available after delivery or completed booking.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4"><p className="text-xs text-[#7a5c4e]">Available</p><p className="text-2xl font-bold">{Math.max(0, balance.available)}</p></div>
        <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4"><p className="text-xs text-[#7a5c4e]">Pending</p><p className="text-2xl font-bold">{Math.max(0, balance.pending)}</p></div>
        <div className="rounded-2xl border border-[#e8d5c4] bg-white p-4"><p className="text-xs text-[#7a5c4e]">Reserved</p><p className="text-2xl font-bold">{Math.max(0, balance.reserved)}</p></div>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {(rows || []).map((r) => (
          <li key={r.id} className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2">
            <div className="flex justify-between"><span className="font-semibold">{r.remark || LABELS[r.reason] || r.reason}</span><span className={r.delta >= 0 ? "text-green-700" : "text-red-700"}>{r.delta >= 0 ? "+" : ""}{r.delta}</span></div>
            <p className="text-xs text-[#7a5c4e]">{r.status} · {new Date(r.created_at).toLocaleString()}{r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
