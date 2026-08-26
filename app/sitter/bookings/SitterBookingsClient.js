"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_TYPES } from "@/lib/booking";
import BookingPriceBreakdown from "@/components/booking/BookingPriceBreakdown";
import { formatInTimezone, serviceLocationText, timezoneLabel } from "@/lib/bookingTime";

export default function SitterBookingsClient({ bookings: initial = [], sitterTimezone = "", sitterLocation = null }) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initial);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const tz = timezoneLabel(sitterTimezone);

  async function setStatus(id, status) {
    setBusyId(id);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("bookings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
      setBookings((list) => list.map((b) => b.id === id ? { ...b, status } : b));
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not update booking.");
    } finally {
      setBusyId("");
    }
  }

  if (!bookings.length) {
    return <p className="mt-8 rounded-2xl border border-dashed border-[#e8d5c4] bg-white p-6 text-sm text-[#7a5c4e]">No booking requests yet.</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-[#7a5c4e]">Times below are in your base timezone{tz ? <>: <strong>{tz}</strong></> : ""}.</p>
      {bookings.map((b) => {
        const label = SERVICE_TYPES[b.service_type]?.label || b.service_type || "Booking";
        const slots = b.booking_slots || [];
        const customer = b.profiles || b.customer || {};
        const pets = b.pets || [];
        const paid = b.payment_received || b.payment_status === "paid";
        return (
          <article key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2a22]">{label}</h2>
                <p className="text-sm text-[#7a5c4e]">{customer.full_name || "Customer"} · {customer.email || ""}</p>
                <p className="text-xs text-[#7a5c4e]">Service location: {serviceLocationText(b, b.sitters || sitterLocation)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-[#5c4033]">{b.status}</span>
                <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (paid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                  {paid ? "Paid" : `Payment: ${b.payment_method || "pending"}`}
                </span>
              </div>
            </div>

            {slots.length ? (
              <ul className="mt-3 space-y-2 text-sm text-[#5c4033]">
                {slots.map((slot) => (
                  <li key={slot.id || slot.starts_at} className="rounded-lg border border-[#e8d5c4]/80 bg-white px-3 py-2">
                    <span className="font-semibold">Your time:</span> {formatInTimezone(slot.starts_at, sitterTimezone)} → {formatInTimezone(slot.ends_at, sitterTimezone)}
                  </li>
                ))}
              </ul>
            ) : null}

            <BookingPriceBreakdown breakdown={b.price_breakdown} showKeep />
            {pets.length ? <p className="mt-2 text-sm text-[#5c4033]"><span className="font-semibold">Paws to be serviced:</span> {pets.map((p) => p.name).filter(Boolean).join(", ")}</p> : null}
            {b.pet_notes ? <p className="mt-2 text-sm text-[#7a5c4e]">Pets: {b.pet_notes}</p> : null}
            {b.customer_message || b.customer_notes ? <p className="mt-1 text-sm text-[#7a5c4e]">Message: {b.customer_message || b.customer_notes}</p> : null}

            {b.status === "pending" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "accepted")} className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busyId === b.id ? "Saving…" : "Accept"}
                </button>
                <button type="button" disabled={busyId === b.id} onClick={() => setStatus(b.id, "declined")} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033] disabled:opacity-60">
                  Decline
                </button>
              </div>
            ) : null}

            {!paid && b.status === "accepted" ? <p className="mt-4 text-xs text-[#7a5c4e]">Payment status is managed by the customer, Stripe, and administrators. Sitters cannot mark payments paid.</p> : null}
          </article>
        );
      })}
    </div>
  );
}
