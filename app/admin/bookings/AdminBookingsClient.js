"use client";

import { useState } from "react";

function money(cents) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

function feeFor(booking) {
  const breakdown = booking.price_breakdown || {};
  const subtotal = Math.round((Number(booking.estimated_total) || 0) * 100);
  const fee = Number(breakdown.paw_service_fee_cents ?? breakdown.service_fee_cents ?? Math.round(subtotal * 0.1));
  const total = Number(breakdown.customer_total_cents ?? breakdown.total_cents ?? subtotal + fee);
  return { subtotal, fee, total };
}

function serviceLabel(type) {
  return ({ house_sit: "House Sit", drop_in: "Drop-in", walking: "Dog Walking", boarding: "Boarding" })[type] || type || "Booking";
}

export default function AdminBookingsClient({ initialBookings = [] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function markPaid(id) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/admin/bookings/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark paid.");
      setBookings((list) => list.map((b) => b.id === id ? { ...b, payment_status: "paid", payment_received: true } : b));
    } catch (err) {
      setError(err.message || "Could not mark paid.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {bookings.length === 0 ? <p className="text-sm text-[#7a5c4e]">No bookings yet.</p> : null}
      {bookings.map((b) => {
        const price = feeFor(b);
        const slots = b.booking_slots || [];
        const canManualPay = b.payment_method === "etransfer" && b.payment_status !== "paid" && !b.payment_received;
        return (
          <article key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2a22]">{serviceLabel(b.service_type)}</h2>
                <p className="text-[#7a5c4e]">Customer: {b.customer?.full_name || "Customer"} · {b.customer?.email || ""}</p>
                <p className="text-[#7a5c4e]">Sitter: {b.sitters?.display_name || "Sitter"} · {b.sitters?.invite_email || ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-[#5c4033]">{b.status}</span>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (b.payment_status === "paid" || b.payment_received ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                  {b.payment_status === "paid" || b.payment_received ? "Paid" : `Payment: ${b.payment_method || "pending"}`}
                </span>
              </div>
            </div>
            {slots.length ? <ul className="mt-3 space-y-1 text-[#5c4033]">{slots.map((slot) => <li key={slot.id || slot.starts_at}>{new Date(slot.starts_at).toLocaleString()} → {slot.ends_at ? new Date(slot.ends_at).toLocaleString() : ""}</li>)}</ul> : null}
            <div className="mt-3 max-w-sm rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-xs text-[#5c4033]">
              <p className="flex justify-between gap-3"><span>Sitter service subtotal</span><span>{money(price.subtotal)}</span></p>
              <p className="mt-1 flex justify-between gap-3"><span>Paw Service Fee (10%)</span><span>{money(price.fee)}</span></p>
              <p className="mt-1 flex justify-between gap-3 font-semibold text-[#3b2a22]"><span>Customer should pay</span><span>{money(price.total)}</span></p>
            </div>
            {canManualPay ? (
              <div className="mt-4">
                <button type="button" disabled={busy === b.id} onClick={() => markPaid(b.id)} className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy === b.id ? "Saving…" : "Mark e-transfer paid"}
                </button>
                <p className="mt-1 text-xs text-[#7a5c4e]">Admin confirmation only. Stripe card payments are marked paid automatically.</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
