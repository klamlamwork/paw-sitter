"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBookingPaid, dollarsToCents } from "@/lib/money";
import { quoteBookingCustomerTotal } from "@/lib/pawServiceFee";
import PawPointsCheckout from "@/components/shop/PawPointsCheckout";
import BookingPriceBreakdown from "@/components/booking/BookingPriceBreakdown";
import { formatInTimezone, serviceLocationText, timezoneLabel } from "@/lib/bookingTime";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  return (new Date(startsAtISO).getTime() - Date.now()) / (1000 * 60 * 60);
}

function money(cents) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

function serviceLabel(type) {
  return ({ house_sit: "House Sit", boarding: "Boarding", walking: "Dog Walking", dog_walking: "Dog Walking", drop_in: "Drop-in", day_care: "Day Care", grooming: "Grooming" })[type] || "Sitter booking";
}

export default function AccountBookingsClient({ bookings = [], displayTimezone = "" }) {
  const [openId, setOpenId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [methods, setMethods] = useState(null);
  const [pawByBooking, setPawByBooking] = useState({});
  const tz = timezoneLabel(displayTimezone);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sitter_payments")
        .select("stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled")
        .limit(1);
      if (cancelled) return;
      const settings = data?.[0];
      setMethods({
        card: settings?.card_enabled ?? settings?.stripe_enabled ?? false,
        etransfer: settings?.etransfer_enabled ?? true,
        later: settings?.pay_later_enabled ?? true,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  async function startPay(bookingId, paymentMethod) {
    setBusyId(bookingId);
    setError("");
    try {
      const paw = pawByBooking[bookingId] || {};
      const res = await fetch("/api/booking/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, payment_method: paymentMethod, paw_points: paw.points || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment.");
      if (paymentMethod === "card") {
        window.location.href = data.url;
        return;
      }
      if (paymentMethod === "etransfer") {
        window.location.href = "/booking/etransfer-confirmation";
        return;
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not start payment.");
      setBusyId("");
    }
  }

  async function cancelBooking(bookingId) {
    setBusyId(bookingId);
    setError("");
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel booking.");
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not cancel booking.");
      setBusyId("");
    }
  }

  return (
    <>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {bookings.length === 0 ? <li className="text-sm text-[#7a5c4e]">No bookings yet.</li> : bookings.map((b) => {
          const slots = b.booking_slots || [];
          const startsAt = slots[0]?.starts_at;
          const lastSlot = slots[slots.length - 1];
          const paid = isBookingPaid(b) || b.payment_status === "paid" || b.payment_received;
          const showPay = b.status === "accepted" && !paid;
          const canPay = hoursUntilUTC(startsAt) === null || hoursUntilUTC(startsAt) >= 48;
          const open = openId === b.id;
          const paw = pawByBooking[b.id] || {};
          const subtotalCents = dollarsToCents(b.estimated_total);
          const quoted = quoteBookingCustomerTotal({ subtotalCents, pointsCents: paw.cents || 0 });
          const overnight = b.service_type === "house_sit" || b.service_type === "boarding";
          return (
            <li key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{serviceLabel(b.service_type)}</span>
                <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs capitalize text-[#c45c26]">{b.status}</span>
              </div>
              <p className="mt-1 text-sm text-[#5c4033]">Service location: {serviceLocationText(b)}</p>
              {slots.length ? (
                overnight && startsAt && lastSlot?.ends_at ? <p className="mt-1 text-sm text-[#5c4033]"><span className="font-semibold">Your time:</span> {formatInTimezone(startsAt, displayTimezone)} → {formatInTimezone(lastSlot.ends_at, displayTimezone)} <span className="text-[#7a5c4e]">({tz})</span></p> :
                <div className="mt-1 space-y-1 text-sm text-[#5c4033]">{slots.map((slot) => <p key={slot.id || slot.starts_at}><span className="font-semibold">Your time:</span> {formatInTimezone(slot.starts_at, displayTimezone)} → {formatInTimezone(slot.ends_at, displayTimezone)} <span className="text-[#7a5c4e]">({tz})</span></p>)}</div>
              ) : null}
              {b.price_breakdown ? <BookingPriceBreakdown breakdown={b.price_breakdown} hideSitterRate customerTotalLabel="Order total" /> : <div className="mt-2 rounded-xl border border-[#f0e0d2] bg-white px-3 py-2 text-xs text-[#5c4033]"><p className="flex justify-between"><span>Paw Service Fee</span><span>{money(quoted.feeCents)}</span></p><p className="mt-1 flex justify-between font-semibold text-[#3b2a22]"><span>Order total</span><span>{money(quoted.customerPayCents)}</span></p></div>}
              <p className="mt-2 text-xs text-[#7a5c4e]">Payment: <span className="font-semibold capitalize">{paid ? "paid" : b.payment_method || b.payment_status || "pending"}</span>{paid ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">Paid</span> : null}</p>

              {showPay ? (!canPay ? <p className="mt-2 text-xs text-red-600">Payment must be made at least 48 hours before the booking starts.</p> : <div className="mt-3"><button type="button" onClick={() => setOpenId(open ? "" : b.id)} disabled={!methods} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{methods ? (open ? "Hide payment options" : "Pay now") : "Loading payment options…"}</button>{open && methods ? <div className="mt-2 space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3"><PawPointsCheckout orderCents={subtotalCents} items={[{ net_cents: subtotalCents, qty: 1, source_key: "sitter_booking" }]} onChange={(next) => setPawByBooking((prev) => ({ ...prev, [b.id]: next }))} />{methods.card ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "card")} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Pay with card</button> : null}{methods.etransfer ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "etransfer")} className="ml-2 rounded-full border border-[#c45c26] px-4 py-1.5 text-xs font-semibold text-[#c45c26] disabled:opacity-60">E-transfer</button> : null}{methods.later ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "later")} className="ml-2 rounded-full border border-[#e8d5c4] px-4 py-1.5 text-xs font-semibold disabled:opacity-60">Pay later</button> : null}</div> : null}</div>) : null}

              {b.status !== "canceled" && b.status !== "completed" ? <button type="button" disabled={busyId === b.id} onClick={() => cancelBooking(b.id)} className="mt-3 rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-60">Cancel booking</button> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
