"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortPreferredFirst } from "./preferredSitter";
import { SERVICE_TYPES, dropInDurationOptions, estimateHouseSitTotal, estimateDropInVisitTotal } from "@/lib/booking";
import GooglePlacesAutocomplete from "./GooglePlacesAutocomplete";

export default function BookingWizard({
  customerId,
  customerProfile,
  sitters,
  services,
  weekly,
  overrides,
  busyBySitter,
  dayAvailability,
  holidayDates = [],
  preferredSitterId = "",
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [address, setAddress] = useState({ formatted_address: "", lat: null, lng: null, city: "", state: "", postal_code: "", country: "" });

  const [form, setForm] = useState({
    city: "",
    service_type: "house_sit",
    start_date: "",
    end_date: "",
    drop_in_duration: 60,
    sitter_id: preferredSitterId || "",
    payment_method: "card",
  });

  const holidaySet = new Set(holidayDates || []);
  const sitterServicesMap = {};
  for (const s of services || []) {
    if (!sitterServicesMap[s.sitter_id]) sitterServicesMap[s.sitter_id] = [];
    sitterServicesMap[s.sitter_id].push(s);
  }

  const availableSitters = (() => {
    if (!address.city || !form.service_type || !form.start_date) return [];
    const list = (sitters || []).filter((sitter) => {
      const svc = (sitterServicesMap[sitter.id] || []).find(
        (x) => x.service_type === form.service_type && x.enabled
      );
      if (!svc) return false;
      if (sitter.service_city !== address.city) return false;
      return true;
    });
    return sortPreferredFirst(list, preferredSitterId);
  })();

  const estimatedTotal = (() => {
    if (!form.start_date || !form.end_date || !form.sitter_id) return 0;
    const sitter = (sitters || []).find((s) => String(s.id) === String(form.sitter_id));
    if (!sitter) return 0;
    const svc = (sitterServicesMap[sitter.id] || []).find(
      (x) => x.service_type === form.service_type && x.enabled
    );
    if (!svc) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (form.service_type === "house_sit") {
      const { total } = estimateHouseSitTotal({
        start,
        end,
        rateRegular: svc.rate_regular,
        rateHoliday: svc.rate_holiday,
        holidaySet,
      });
      return total;
    } else {
      const { total } = estimateDropInVisitTotal({
        minutes: Number(form.drop_in_duration) || 60,
        startsAt: start,
        rateRegular: svc.rate_regular,
        rateHoliday: svc.rate_holiday,
        holidaySet,
      });
      return total;
    }
  })();

  async function submitBooking() {
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: payments } = await supabase.from("sitter_payments").select("stripe_enabled").limit(1);
      const enabled = payments?.[0]?.stripe_enabled !== false;
      setStripeEnabled(enabled);

      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          sitter_id: form.sitter_id,
          service_type: form.service_type,
          status: "pending",
          payment_method: form.payment_method,
          payment_status: "pending",
          estimated_total: estimatedTotal,
          service_address: address.formatted_address,
          service_address_lat: address.lat,
          service_address_lng: address.lng,
          service_address_city: address.city,
          service_address_state: address.state,
          service_address_postal_code: address.postal_code,
          service_address_country: address.country,
          customer_notes: "",
          pet_notes: "",
        })
        .select("id")
        .single();

      if (bErr) throw bErr;

      // TODO: attach selected pets via booking_pets join in next batch

      window.location.href = `/booking?placed=1&booking=${booking.id}`;
    } catch (err) {
      setError(err.message || "Could not place booking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {step === 1 && (
        <>
          <h2 className="text-xl font-semibold">Step 1 — Where & service</h2>
          <label className="block text-sm">
            <span className="font-medium">Where</span>
            <GooglePlacesAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="Type your address"
            />
            {address.formatted_address && (
              <p className="mt-1 text-xs text-[#7a5c4e]">{address.formatted_address}</p>
            )}
          </label>
          <label className="block text-sm">
            <span className="font-medium">Service type</span>
            <select
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.service_type}
              onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            >
              <option value="house_sit">House sit</option>
              <option value="drop_in">Drop-in visits</option>
              <option value="dog_walking">Dog walking</option>
              <option value="boarding">Boarding</option>
            </select>
          </label>
          {form.service_type === "drop_in" && (
            <label className="block text-sm">
              <span className="font-medium">How long</span>
              <select
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
                value={form.drop_in_duration}
                onChange={(e) => setForm({ ...form, drop_in_duration: Number(e.target.value) })}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!address.city || !form.service_type}
              className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-xl font-semibold">Step 2 — Dates</h2>
          <label className="block text-sm">
            <span className="font-medium">Start date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">End date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!form.start_date || !form.end_date}
              className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-xl font-semibold">Step 3 — Choose sitter</h2>
          {availableSitters.length === 0 ? (
            <p className="text-sm text-[#7a5c4e]">No sitters match. Adjust city or dates.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableSitters.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="sitter_id"
                    checked={form.sitter_id === s.id}
                    onChange={() => setForm({ ...form, sitter_id: s.id })}
                  />
                  <span>{s.display_name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!form.sitter_id || estimatedTotal <= 0}
              className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2 className="text-xl font-semibold">Step 4 — Review & submit</h2>
          <p className="text-sm text-[#7a5c4e]">
            Order amount: <strong>${(estimatedTotal / 100).toFixed(2)}</strong> • Platform fee 10% • Sitter gets 90%
          </p>
          <fieldset className="rounded-2xl border border-[#e8d5c4] p-3">
            <legend className="px-1 text-sm font-medium">How will you pay?</legend>
            {stripeEnabled && (
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="radio" name="payment_method" checked={form.payment_method === "card"} onChange={() => setForm({ ...form, payment_method: "card" })} />
                <span>Card (Stripe)</span>
              </label>
            )}
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="radio" name="payment_method" checked={form.payment_method === "etransfer"} onChange={() => setForm({ ...form, payment_method: "etransfer" })} />
              <span>Interac e-Transfer (seller confirms when received)</span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="radio" name="payment_method" checked={form.payment_method === "later"} onChange={() => setForm({ ...form, payment_method: "later" })} />
              <span>Pay later</span>
            </label>
          </fieldset>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setStep(3)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button>
            <button
              type="button"
              onClick={submitBooking}
              disabled={submitting || !form.sitter_id || estimatedTotal <= 0}
              className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Working…" : "Submit booking request"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
