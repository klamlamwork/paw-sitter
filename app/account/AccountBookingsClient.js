"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBookingPaid, dollarsToCents } from "@/lib/money";
import { quoteBookingCustomerTotal } from "@/lib/pawServiceFee";
import PawPointsCheckout from "@/components/shop/PawPointsCheckout";
import ConfirmBookingPaid from "./ConfirmBookingPaid";
import BookingPriceBreakdown from "@/components/booking/BookingPriceBreakdown";
import { formatInTimezone, serviceLocationText, timezoneLabel } from "@/lib/bookingTime";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  return (new Date(startsAtISO).getTime() - Date.now()) / (1000 * 60 * 60);
}

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function serviceLabel(type) {
  switch (type) {
    case "house_sit": return "House Sit";
    case "boarding": return "Boarding";
    case "walking":
    case "dog_walking": return "Dog Walking";
    case "drop_in": return "Drop-in";
    case "day_care": return "Day Care";
    case "grooming": return "Grooming";
    default: return "Sitter booking";
  }
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
      const { data } = await supabase.from("sitter_payments").select("stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled").limit(1);
      if (!cancelled) {
        const settings = data?.[0];
        setMethods({
          card: settings?.card_enabled ?? settings?.stripe_enabled ?? false,
          etransfer: settings?.etransfer_enabled ?? true,
          later: settings?.pay_later_enabled ?? true,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function pointsFor(bookingId) {
    const typed = document.getElementById(`paw-${bookingId}`)?.value;
    const fromState = pawByBooking[bookingId]?.points;
    return Math.floor(Number(typed ?? fromState) || 0);
  }

  async function startPay(bookingId, paymentMethod) {
    setError("");
    setBusyId(bookingId);
    try {
      const res = await fetch("/api/booking/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          payment_method: paymentMethod,
          paw_points: pointsFor(bookingId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start payment");
      if (data.url) window.location.href = data.url;
      else window.location.reload();
    } catch (err) {
      setError(err.message || "Could not start payment");
      setBusyId("");
    }
  }

  async function cancelBooking(bookingId) {
    setBusyId(bookingId);
    try {
      const res = await fetch("/api/booking/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: bookingId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel");
      window.location.reload();
    } catch (err) {
      setError(err.message || "Could not cancel");
      setBusyId("");
    }
  }

  return (
    <>
      <ConfirmBookingPaid />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {bookings.length === 0 ? <li className="text-sm text-[#7a5c4e]">No bookings yet.</li> : bookings.map((b) => {
          const slots = b.booking_slots || [];
          const startsAtISO = slots[0]?.starts_at;
          const lastSlot = slots[slots.length - 1];
          const hoursUntilStart = hoursUntilUTC(startsAtISO);
          const paid = isBookingPaid(b);
          const showPay = b.status === "accepted" && !paid;
          const canPay = hoursUntilStart === null || hoursUntilStart >= 48;
          const canCancel = b.status !== "canceled" && b.status !== "completed";
          const isLateCancel = hoursUntilStart !== null && hoursUntilStart < 48;
          const hasPayment = paid || b.payment_status === "authorized" || b.payment_status === "paid";
          const open = openId === b.id;
          const noMethods = methods && !methods.card && !methods.etransfer && !methods.later;
          const subtotalCents = dollarsToCents(b.estimated_total);
          const paw = pawByBooking[b.id] || {};
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
                overnight && startsAtISO && lastSlot?.ends_at ? (
                  <p className="mt-1 text-sm text-[#5c4033]">
                    <span className="font-semibold">Your time:</span> {formatInTimezone(startsAtISO, displayTimezone)} → {formatInTimezone(lastSlot.ends_at, displayTimezone)} <span className="text-[#7a5c4e]">({tz})</span>
                  </p>
                ) : (
                  <div className="mt-1 space-y-1 text-sm text-[#5c4033]">
                    {slots.map((s) => (
                      <p key={s.id || s.starts_at}>
                        <span className="font-semibold">Your time:</span> {formatInTimezone(s.starts_at, displayTimezone)}{s.ends_at ? ` → ${formatInTimezone(s.ends_at, displayTimezone)}` : ""} <span className="text-[#7a5c4e]">({tz})</span>
                      </p>
                    ))}
                  </div>
                )
              ) : null}
              {b.price_breakdown ? (
                <BookingPriceBreakdown breakdown={b.price_breakdown} hideSitterRate customerTotalLabel="Order total" />
              ) : (
                <div className="mt-2 rounded-xl border border-[#f0e0d2] bg-white px-3 py-2 text-xs text-[#5c4033]">
                  <p className="flex justify-between gap-3"><span>Paw Service Fee</span><span>{money(quoted.feeCents)}</span></p>
                  <p className="mt-1 flex justify-between gap-3 font-semibold text-[#3b2a22]"><span>Order total</span><span>{money(quoted.customerPayCents)}</span></p>
                </div>
              )}
              {showPay && (!canPay ? <p className="mt-2 text-xs text-red-600">Payment must be made at least 48 hours before the booking starts.</p> : noMethods ? <p className="mt-2 text-xs text-[#7a5c4e]">Payment options are currently unavailable.</p> : <div className="mt-2">
                <button type="button" onClick={() => setOpenId(open ? "" : b.id)} disabled={!methods} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{methods ? (open ? "Hide payment options" : "Pay now") : "Loading payment options…"}</button>
                {open && methods ? <div className="mt-2 space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3">
                  <p className="text-xs text-[#7a5c4e]">Points reduce the Paw Service Fee only. The sitter still receives {money(subtotalCents)}.</p>
                  <PawPointsCheckout
                    inputId={`paw-${b.id}`}
                    sourceKey="sitter_booking"
                    orderCents={subtotalCents}
                    items={[{ net_cents: subtotalCents, qty: 1, source_key: "sitter_booking" }]}
                    onChange={(p) => setPawByBooking((m) => ({ ...m, [b.id]: p }))}
                  />
                  {methods.card ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "card")} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Pay with card {money(quoted.customerPayCents)}</button> : null}
                  {methods.etransfer ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "etransfer")} className="ml-2 rounded-full border border-[#c45c26] px-4 py-1.5 text-xs font-semibold text-[#c45c26] disabled:opacity-60">E-transfer</button> : null}
                  {methods.later ? <button type="button" disabled={busyId === b.id} onClick={() => startPay(b.id, "later")} className="ml-2 rounded-full border border-[#e8d5c4] px-4 py-1.5 text-xs font-semibold disabled:opacity-60">Pay later</button> : null}
                </div> : null}
              </div>)}
              {canCancel ? <div className="mt-2">{isLateCancel && hasPayment ? <p className="text-xs text-amber-700">Late cancel: 50% will be charged, remainder refunded.</p> : null}<button type="button" disabled={busyId === b.id} onClick={() => cancelBooking(b.id)} className="rounded-full border border-[#e8d5c4] bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-60">Cancel booking</button></div> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
