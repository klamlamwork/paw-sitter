"use client";

import { useState } from "react";

export default function PawPointsAdminClient({ settings, rates = [] }) {
  const [form, setForm] = useState(settings || {});
  const [rateRows, setRateRows] = useState(rates);
  const [userIds, setUserIds] = useState("");
  const [grantPts, setGrantPts] = useState("100");
  const [remark, setRemark] = useState("");
  const [msg, setMsg] = useState("");

  async function saveRates() {
    setMsg("");
    const res = await fetch("/api/admin/paw-points/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          default_product_points_per_dollar: Number(form.default_product_points_per_dollar),
          booking_points_per_dollar: Number(form.booking_points_per_dollar),
          min_redeem_points: Number(form.min_redeem_points),
          max_redeem_pct: Number(form.max_redeem_pct),
          expire_inactive_months: Number(form.expire_inactive_months),
        },
        rates: rateRows,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Rates saved." : data.error);
  }

  async function grant() {
    setMsg("");
    const ids = userIds.split(/[,\s]+/).filter(Boolean);
    const res = await fetch("/api/admin/paw-points/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: ids, points: Number(grantPts), remark }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Granted to ${ids.length} account(s).` : data.error);
  }

  return (
    <div className="mt-6 space-y-8">
      {msg ? <p className="text-sm text-[#c45c26]">{msg}</p> : null}
      <section className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h2 className="font-semibold">Global rules</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Product pts / $1<input className="mt-1 w-full border border-[#e8d5c4] px-2 py-1" type="number" value={form.default_product_points_per_dollar || 10} onChange={(e) => setForm({ ...form, default_product_points_per_dollar: e.target.value })} /></label>
          <label className="text-sm">Booking pts / $1<input className="mt-1 w-full border border-[#e8d5c4] px-2 py-1" type="number" value={form.booking_points_per_dollar || 5} onChange={(e) => setForm({ ...form, booking_points_per_dollar: e.target.value })} /></label>
          <label className="text-sm">Min redeem<input className="mt-1 w-full border border-[#e8d5c4] px-2 py-1" type="number" value={form.min_redeem_points || 100} onChange={(e) => setForm({ ...form, min_redeem_points: e.target.value })} /></label>
          <label className="text-sm">Max % of order<input className="mt-1 w-full border border-[#e8d5c4] px-2 py-1" type="number" value={form.max_redeem_pct || 40} onChange={(e) => setForm({ ...form, max_redeem_pct: e.target.value })} /></label>
        </div>
      </section>
      <section className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h2 className="font-semibold">Type multipliers</h2>
        <ul className="mt-3 space-y-2">
          {rateRows.map((r, i) => (
            <li key={r.source_key} className="flex items-center justify-between gap-3 text-sm">
              <span>{r.label}</span>
              <input className="w-24 border border-[#e8d5c4] px-2 py-1" type="number" value={r.points_per_dollar} onChange={(e) => setRateRows((list) => list.map((x, idx) => idx === i ? { ...x, points_per_dollar: e.target.value } : x))} />
            </li>
          ))}
        </ul>
        <button type="button" onClick={saveRates} className="mt-4 rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white">Save rates</button>
      </section>
      <section className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <h2 className="font-semibold">Manual grant</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">Paste profile UUIDs. Remark is required for audit.</p>
        <textarea className="mt-2 w-full border border-[#e8d5c4] px-2 py-1 text-sm" rows={3} placeholder="uuid, uuid" value={userIds} onChange={(e) => setUserIds(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="w-28 border border-[#e8d5c4] px-2 py-1" type="number" value={grantPts} onChange={(e) => setGrantPts(e.target.value)} />
          <input className="min-w-[200px] flex-1 border border-[#e8d5c4] px-2 py-1" placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
          <button type="button" onClick={grant} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white">Grant</button>
        </div>
      </section>
    </div>
  );
}
