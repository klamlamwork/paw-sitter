"use client";

import { useState } from "react";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function AdminDiscountsClient({ initial = [] }) {
  const [codes, setCodes] = useState(initial);
  const [form, setForm] = useState({
    code: "",
    label: "",
    kind: "admin",
    scope: "site",
    type: "percent",
    percent_off: 10,
    fixed_off_cents: 1000,
    min_spend_cents: 0,
    category_ids: [],
    first_booking_only: false,
    applies_to_shipping: false,
    max_redemptions: "",
    max_per_user: 1,
    expires_at: "",
    funded_by_platform: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createCode() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/discounts", {
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

  async function toggleActive(id, next) {
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update");
      setCodes((list) => list.map((c) => (c.id === id ? { ...c, active: next } : c)));
    } catch (err) {
      setError(err.message || "Could not update");
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 lg:col-span-1">
        <h2 className="text-lg font-semibold text-[#3b2a22]">New code</h2>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        <div className="mt-3 space-y-2 text-sm">
          <label className="block">Code<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="block">Label<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label className="block">Kind
            <select className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
          <label className="block">Scope
            <select className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              <option value="site">Site-wide</option>
              <option value="category">Category</option>
              <option value="booking">Booking (sitter)</option>
              <option value="shop_order">Shop order</option>
            </select>
          </label>
          <label className="block">Type
            <select className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount</option>
              <option value="threshold">Threshold (fixed off min spend)</option>
              <option value="shipping">Shipping</option>
            </select>
          </label>
          {form.type === "percent" ? (
            <label className="block">Percent off<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.percent_off} onChange={(e) => setForm({ ...form, percent_off: e.target.value })} /></label>
          ) : (
            <label className="block">Fixed off (cents)<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.fixed_off_cents} onChange={(e) => setForm({ ...form, fixed_off_cents: e.target.value })} /></label>
          )}
          <label className="block">Min spend (cents)<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.min_spend_cents} onChange={(e) => setForm({ ...form, min_spend_cents: e.target.value })} /></label>
          <label className="flex items-center gap-2">First booking only<input type="checkbox" checked={form.first_booking_only} onChange={(e) => setForm({ ...form, first_booking_only: e.target.checked })} /></label>
          <label className="flex items-center gap-2">Applies to shipping<input type="checkbox" checked={form.applies_to_shipping} onChange={(e) => setForm({ ...form, applies_to_shipping: e.target.checked })} /></label>
          <label className="block">Max redemptions<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} /></label>
          <label className="block">Max per user<input type="number" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.max_per_user} onChange={(e) => setForm({ ...form, max_per_user: e.target.value })} /></label>
          <label className="block">Expires at<input type="datetime-local" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
          {form.kind === "admin" ? (
            <label className="flex items-center gap-2">Platform-funded<input type="checkbox" checked={form.funded_by_platform} onChange={(e) => setForm({ ...form, funded_by_platform: e.target.checked })} /></label>
          ) : null}
          <button disabled={busy} onClick={createCode} className="mt-2 w-full rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Create</button>
        </div>
      </div>
      <div className="lg:col-span-2">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Codes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-[#e8d5c4] bg-white p-3">
              <div>
                <p className="font-semibold">{c.code} <span className="text-xs text-[#7a5c4e]">({c.label || c.kind})</span></p>
                <p className="text-xs text-[#7a5c4e]">{c.type} • {c.scope} • {c.active ? "active" : "inactive"} {c.expires_at ? `• ends ${new Date(c.expires_at).toLocaleString()}` : ""}</p>
              </div>
              <button onClick={() => toggleActive(c.id, !c.active)} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">{c.active ? "Disable" : "Enable"}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
