"use client";

import { useState } from "react";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function SitterCancelBooking({ bookingId }) {
  const [quote, setQuote] = useState(null);
  const [mode, setMode] = useState("cancel");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadQuote(nextMode) {
    setBusy(true);
    setError("");
    setMode(nextMode);
    try {
      const waive = nextMode === "waive" ? "1" : "0";
      const res = await fetch(`/api/booking/sitter-cancel?booking_id=${bookingId}&waive=${waive}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load refund quote");
      setQuote(data.quote);
    } catch (err) {
      setError(err.message || "Could not load refund quote");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const label = mode === "waive" ? "waive the policy and refund remaining days in full" : "cancel remaining days and refund the owner 100%";
    if (!confirm(`This will ${label}. Continue?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/booking/sitter-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, waive_remaining: mode === "waive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel");
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not cancel");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => loadQuote("cancel")} disabled={busy} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
          Cancel remaining
        </button>
        <button type="button" onClick={() => loadQuote("waive")} disabled={busy} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
          Waive policy
        </button>
      </div>
      {quote ? (
        <>
          <p className="text-xs text-[#7a5c4e]">{quote.summary}</p>
          <p className="text-xs">Owner refund {money(quote.refund_cents)} · You keep {money(quote.retained_cents)}</p>
          <button type="button" onClick={confirm} disabled={busy} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {busy ? "Working…" : "Confirm"}
          </button>
        </>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
