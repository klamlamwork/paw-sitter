"use client";

import { useState } from "react";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function DiscountsClient({ initial = [], shopId }) {
  const [codes, setCodes] = useState(initial);
  const [form, setForm] = useState({
    code: "",
    label: "",
    type: "percent",
    percent_off: 10,
    fixed_off_cents: 1000,
    min_spend_cents: 0,
    max_redemptions: "",
    max_per_user: 1,
    expires_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createCode() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/vendor/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          percent_off: form.type === "percent" ? Number(form.percent_off) : null,
          fixed_off_cents: form.type !== "percent" ? Number(form.fixed_off_cents) : null,
          min_spend_cents: form.min_spend_cents ? Number(form.min_spend_cents) : null,
          max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create code");
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not create code");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 lg:col-span-1">
        <h2 className="text-lg font-semibold text-[#3b2a22]">New shop code</h2>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-3 space-y-2 text-sm">
          <label className="block">Code<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="block">Label<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label className="block">Type
            <select className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount</option>
              <option value="threshold">Threshold (fixed off min spend)</option>
            </select>
          </label>
          {form.type === "percent" ? (
            <label className="block">Percent off<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.percent_off} onChange={(e) => setForm({ ...form, percent_off: e.target.value })} /></label>
          ) : (
            <label className="block">Fixed off (cents)<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.fixed_off_cents} onChange={(e) => setForm({ ...form, fixed_off_cents: e.target.value })} /></label>
          )}
          <label className="block">Min spend (cents)<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.min_spend_cents} onChange={(e) => setForm({ ...form, min_spend_cents: e.target.value })} /></label>
          <label className="block">Max redemptions<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} /></label>
          <label className="block">Max per user<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.max_per_user} onChange={(e) => setForm({ ...form, max_per_user: e.target.value })} /></label>
          <label className="block">Expires at<input type="datetime-local" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
          <button disabled={busy} onClick={createCode} className="mt-2 w-full rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Create</button>
        </div>
      </div>
      <div className="lg:col-span-2">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Your codes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {codes.map((c) => (
            <li key={c.id} className="rounded-xl border border-[#e8d5c4] bg-white p-3">
              <p className="font-semibold">{c.code} <span className="text-xs text-[#7a5c4e]">({c.label || c.type})</span></p>
              <p className="text-xs text-[#7a5c4e]">{c.type} • min {money(c.min_spend_cents || 0)} • {c.active ? "active" : "inactive"} {c.expires_at ? `• ends ${new Date(c.expires_at).toLocaleString()}` : ""}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
