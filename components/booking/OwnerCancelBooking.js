"use client";

import { useState } from "react";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function OwnerCancelBooking({ bookingId }) {
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadQuote() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/booking/cancel?booking_id=${bookingId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load refund quote");
      setQuote(data.quote);
    } catch (err) {
      setError(err.message || "Could not load refund quote");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!confirm("Cancel this booking and issue the quoted refund?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
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
      {!quote ? (
        <button type="button" onClick={loadQuote} disabled={busy} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-60">
          {busy ? "Checking refund…" : "Cancel booking"}
        </button>
      ) : (
        <>
          <p className="text-xs text-[#7a5c4e]">{quote.summary}</p>
          <p className="text-xs">Refund {money(quote.refund_cents)} · Sitter keeps {money(quote.retained_cents)}</p>
          <button type="button" onClick={confirmCancel} disabled={busy} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {busy ? "Canceling…" : "Confirm cancel"}
          </button>
        </>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
