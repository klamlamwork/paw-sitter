"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";
import { formatInTimezone } from "@/lib/locations";
import BookingPriceBreakdown from "@/components/booking/BookingPriceBreakdown";

export default function SitterBookingsClient({ bookings: initial, sitterTimezone }) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initial || []);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const sitterTz = sitterTimezone || undefined;

  async function setStatus(id, status) {
    setBusyId(id);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("bookings").update({ status }).eq("id", id);
    setBusyId("");
    if (err) { setError(err.message); return; }
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, status } : b)));
    router.refresh();
  }

  async function markPaid(id) {
    setBusyId(id);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("bookings").update({ payment_received: true, payment_received_at: new Date().toISOString(), payment_status: "paid" }).eq("id", id);
    setBusyId("");
    if (err) { setError(err.message); return; }
    setBookings((list) => list.map((b) => (b.id === id ? { ...b, payment_received: true, payment_status: "paid" } : b)));
    router.refresh();
  }

  if (!bookings.length) {
    return <p className="mt-8 rounded-2xl border border-dashed border-[#e8d5c4] bg-white p-6 text-sm text-[#7a5c4e]">No booking requests yet.</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-[#7a5c4e]">Times below are in your base timezone{sitterTz ? <>: <strong>{sitterTz}</strong></> : " (set base city on dashboard for correct local times)"}.</p>
      {bookings.map((b) => {
        const label = SERVICE_TYPES[b.service_type]?.label || b.service_type;
        const slots = b.booking_slots || [];
        const customer = b.profiles;
        const customerTz = customer?.timezone || undefined;
        return (
          <article key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2a22]">{label}</h2>
                <p className="text-sm text-[#7a5c4e]">{customer?.full_name || "Customer"} · {customer?.email || ""}</p>
                {customer?.city ? <p className="text-xs text-[#7a5c4e]">Service location: {customer.city}{customer.country ? `, ${customer.country}` : ""}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#5c4033]">{b.status}</span>
                {b.payment_received || b.payment_status === "paid" ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Paid</span> : null}
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[#5c4033]">
              {slots.map((s) => (
                <li key={s.id || s.starts_at} className="rounded-lg border border-[#e8d5c4]/80 bg-white px-3 py-2">
                  <div><span className="font-semibold">Your time:</span> {formatInTimezone(s.starts_at, sitterTz)} → {formatInTimezone(s.ends_at, sitterTz)}</div>
                  {customerTz && customerTz !== sitterTz ? <div className="mt-0.5 text-xs text-[#7a5c4e]">Customer time: {formatInTimezone(s.starts_at, customerTz)} → {formatInTimezone(s.ends_at, customerTz)}</div> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-[#c45c26]">Estimate: ${Number(b.estimated_total || 0).toFixed(2)} {b.currency || "CAD"}</p>
            <BookingPriceBreakdown breakdown={b.price_breakdown} showKeep />
            {b.pet_notes ? <p className="mt-2 text-sm text-[#7a5c4e]">Pets: {b.pet_notes}</p> : null}
            {b.customer_message ? <p className="mt-1 text-sm text-[#7a5c4e]">Message: {b.customer_message}</p> : null}
            {b.status === "pending" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "accepted")} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Accept</button>
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "declined")} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033] disabled:opacity-60">Decline</button>
              </div>
            ) : null}
            {b.status === "accepted" && !b.payment_received && b.payment_status !== "paid" ? (
              <div className="mt-4">
                <button type="button" disabled={busyId === b.id} onClick={() => markPaid(b.id)} className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busyId === b.id ? "Saving..." : "Mark paid"}</button>
                <p className="mt-1 text-xs text-[#7a5c4e]">Confirm you received payment. The day will show as booked on your calendar.</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
