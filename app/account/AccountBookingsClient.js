"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBookingPaid } from "@/lib/money";

function hoursUntilUTC(startsAtISO) {
  if (!startsAtISO) return null;
  return (new Date(startsAtISO).getTime() - Date.now()) / (1000 * 60 * 60);
}

function serviceLabel(type) {
  switch (type) {
    case "house_sit": return "House sit";
    case "day_care": return "Day care";
    case "grooming": return "Grooming";
    default: return "Sitter booking";
  }
}

export default function AccountBookingsClient({ bookings = [] }) {
  const [openId, setOpenId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [methods, setMethods] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sitter_payments")
        .select("stripe_enabled, card_enabled, etransfer_enabled, pay_later_enabled")
        .limit(1);
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

  async function choosePayment(bookingId, paymentMethod) {
    setError("");
    setBusyId(bookingId);
    try {
      const res = await fetch("/api/booking/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, payment_method }),
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
    setError("");
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
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {bookings.length === 0 ? <li className="text-sm text-[#7a5c4e]">No bookings yet.</li> : bookings.map((b) => {
          const startsAtISO = (b.booking_slots || [])[0]?.starts_at;
          const hoursUntilStart = hoursUntilUTC(startsAtISO);
          const paid = isBookingPaid(b);
          const showPay = b.status === "accepted" && !paid;
          const canPay = hoursUntilStart === null || hoursUntilStart >= 48;
          const canCancel = b.status !== "canceled" && b.status !== "completed";
          const isLateCancel = hoursUntilStart !== null && hoursUntilStart < 48;
          const hasPayment = paid || b.payment_status === "authorized" || b.payment_status === "paid";
          const open = openId === b.id;
          const noMethods = methods && !methods.card && !methods.etransfer && !methods.later;
          return (
            <li key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{serviceLabel(b.service_type)} - {b.sitters?.display_name || "Sitter"}</span>
                <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs capitalize text-[#c45c26]">{b.status}</span>
              </div>
              <p className="mt-1 text-[#7a5c4e]">
                Est. ${Number(b.estimated_total || 0).toFixed(2)} • Payment: <span className="font-medium capitalize">{b.payment_status || "pending"}</span>
                {paid ? <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Paid</span> : null}
                {b.payment_method ? <span className="capitalize"> ({b.payment_method})</span> : null}
              </p>
              {startsAtISO ? <p className="mt-1 text-xs text-[#7a5c4e]">Starts: {new Date(startsAtISO).toLocaleString()}</p> : null}
              {showPay && (!canPay ? <p className="mt-2 text-xs text-red-600">Payment must be made at least 48 hours before the booking starts.</p> : noMethods ? <p className="mt-2 text-xs text-[#7a5c4e]">Payment options are currently unavailable.</p> : <div className="mt-2">
                <button type="button" onClick={() => setOpenId(open ? "" : b.id)} disabled={!methods} className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{methods ? (open ? "Hide payment options" : "Pay now") : "Loading payment options…"}</button>
                {open && methods ? <div className="mt-2 space-y-2 rounded-xl border border-[#e8d5c4] bg-white p-3">
                  <p className="text-xs font-medium text-[#3b2a22]">How will you pay?</p>
                  {methods.card ? <button type="button" disabled={busyId === b.id} onClick={() => choosePayment(b.id, "card")} className="block w-full rounded-lg border border-[#e8d5c4] px-3 py-2 text-left text-xs font-semibold disabled:opacity-60">{busyId === b.id ? "Working…" : "Pay with card (Stripe)"}</button> : null}
                  {methods.etransfer ? <button type="button" disabled={busyId === b.id} onClick={() => choosePayment(b.id, "etransfer")} className="block w-full rounded-lg border border-[#e8d5c4] px-3 py-2 text-left text-xs font-semibold disabled:opacity-60">Interac e-Transfer (seller confirms when received)</button> : null}
                  {methods.later ? <button type="button" disabled={busyId === b.id} onClick={() => choosePayment(b.id, "later")} className="block w-full rounded-lg border border-[#e8d5c4] px-3 py-2 text-left text-xs font-semibold disabled:opacity-60">Pay later</button> : null}
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
