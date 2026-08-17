"use client";

import { useEffect, useState } from "react";

const PRESETS = [500, 1000, 2000];

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function TipBookingButton({ bookingId }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/booking/tip?booking_id=${encodeURIComponent(bookingId)}`);
        const data = await res.json();
        if (!cancelled && res.ok) setInfo(data);
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function pay(amountCents) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/booking/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, amount_cents: amountCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start tip checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not start tip checkout");
      setBusy(false);
    }
  }

  if (!info?.can_tip?.ok) return null;
  const paidTips = (info.tips || []).filter((t) => t.status === "paid");

  return (
    <div className="mt-2 space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold">
        {open ? "Hide tip" : `Add a tip for ${info.sitter_name}`}
      </button>
      {paidTips.length ? (
        <p className="text-xs text-[#7a5c4e]">Tips sent: {paidTips.map((t) => money(t.amount_cents)).join(", ")}. Your sitter keeps 100%.</p>
      ) : null}
      {open ? (
        <div className="rounded-xl border border-[#e8d5c4] bg-white p-3">
          <p className="text-xs text-[#7a5c4e]">Sitters keep 100% of tips. The tip is released to them within 24 hours.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((cents) => (
              <button key={cents} type="button" disabled={busy} onClick={() => pay(cents)} className="rounded-full bg-[#c45c26] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {money(cents)}
              </button>
            ))}
          </div>
          <label className="mt-2 block text-xs">
            Custom amount (CAD)
            <span className="mt-1 flex gap-2">
              <input type="number" min="1" step="1" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-24 rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm" />
              <button type="button" disabled={busy} onClick={() => pay(Math.round(Number(custom) * 100))} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60">
                Tip custom
              </button>
            </span>
          </label>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
