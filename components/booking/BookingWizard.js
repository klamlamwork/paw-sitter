"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortPreferredFirst } from "./preferredSitter";
import { SERVICE_TYPES } from "@/lib/booking";
import { sitterCoversAddress } from "@/lib/sitterMatch";
import { estimateBookingPrice, normalizeServiceType } from "@/lib/bookingPricing";
import GooglePlacesAutocomplete from "./GooglePlacesAutocomplete";
import DatesStep from "./DatesStep";
import PetsStep from "./PetsStep";
import BookingPriceBreakdown from "./BookingPriceBreakdown";

const DEFAULT_BOOKING_MESSAGE = "Hello, I am interested in your service.";

export default function BookingWizard({
  customerId,
  customerProfile = {},
  sitters = [],
  services = [],
  holidayDates = [],
  preferredSitterId = "",
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState(() => ({
    formatted_address:
      customerProfile?.formatted_address ||
      customerProfile?.address ||
      customerProfile?.street_address ||
      [customerProfile?.city, customerProfile?.state, customerProfile?.country]
        .filter(Boolean)
        .join(", ") ||
      "",
    lat: customerProfile?.lat ?? null,
    lng: customerProfile?.lng ?? null,
    city: customerProfile?.city || "",
    state: customerProfile?.state || "",
    postal_code: customerProfile?.postal_code || "",
    country: customerProfile?.country || "",
  }));
  const [datesPayload, setDatesPayload] = useState([]);
  const [selectedPetIds, setSelectedPetIds] = useState([]);
  const [customerMessage, setCustomerMessage] = useState(DEFAULT_BOOKING_MESSAGE);
  const [form, setForm] = useState({
    service_type: Object.values(SERVICE_TYPES)[0]?.id || "drop_in",
    drop_in_duration: 30,
    sitter_id: preferredSitterId || "",
  });

  const sitterServicesMap = {};
  for (const svc of services || []) {
    if (!sitterServicesMap[svc.sitter_id]) sitterServicesMap[svc.sitter_id] = [];
    sitterServicesMap[svc.sitter_id].push(svc);
  }

  function findSvc(sitterId) {
    const wanted = normalizeServiceType(form.service_type);
    return (sitterServicesMap[sitterId] || []).find(
      (x) => normalizeServiceType(x.service_type) === wanted && x.enabled
    );
  }

  const hasAddress = !!(address.formatted_address || address.city || address.lat != null);
  const messageReady = !!customerMessage.trim();

  const availableSitters = (() => {
    if (!form.service_type || datesPayload.length === 0) return [];
    const list = (sitters || []).filter((sitter) => {
      const svc = findSvc(sitter.id);
      if (!svc) return false;
      return sitterCoversAddress(sitter, svc, address);
    });
    return sortPreferredFirst(list, preferredSitterId);
  })();

  const selectedSitter = availableSitters.find((s) => s.id === form.sitter_id) || null;
  const svc = selectedSitter ? findSvc(selectedSitter.id) : null;
  const holidaySet = new Set(holidayDates || []);
  const price = svc
    ? estimateBookingPrice({
        serviceType: form.service_type,
        dates: datesPayload,
        durationMinutes:
          form.service_type === "house_sit" || form.service_type === "boarding"
            ? null
            : Number(form.drop_in_duration) || 30,
        petCount: selectedPetIds.length,
        rateRegular: Number(svc.rate_regular) || 0,
        rateHoliday: Number(svc.rate_holiday) || 0,
        extraPetRate: Number(svc.rate_extra_pet) || 0,
        rate60: Number(svc.rate_60) || 0,
        holidaySet,
      })
    : null;

  const estimatedTotal = price?.total || 0;
  const overnight = form.service_type === "house_sit" || form.service_type === "boarding";
  const timedService =
    form.service_type === "drop_in" || form.service_type === "walking" || form.service_type === "dog_walking";
  const houseSitDatesValid =
    !overnight || (datesPayload.length >= 2 && datesPayload.startTime && datesPayload.endTime);
  const visitTimesValid = overnight || datesPayload.some((d) => (d.times || []).length > 0);

  async function submitBooking() {
    const intro = customerMessage.trim();
    if (!intro) {
      setError("Please write a message for the sitter.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          sitter_id: form.sitter_id,
          service_type: normalizeServiceType(form.service_type),
          estimated_total: estimatedTotal,
          price_breakdown: price || null,
          status: "pending",
          service_address: address.formatted_address || "",
          service_address_city: address.city,
          service_address_state: address.state,
          service_address_postal_code: address.postal_code,
          service_address_country: address.country,
          customer_message: intro,
          customer_notes: intro,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;
      const slots = [];
      if (overnight) {
        if (datesPayload.length >= 2 && datesPayload.startTime && datesPayload.endTime) {
          const start = new Date(datesPayload[0].date);
          const end = new Date(datesPayload[datesPayload.length - 1].date);
          const [sh, sm] = (datesPayload.startTime || "12:00").split(":").map(Number);
          const [eh, em] = (datesPayload.endTime || "12:00").split(":").map(Number);
          start.setHours(sh, sm, 0, 0);
          end.setHours(eh, em, 0, 0);
          const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
          slots.push({
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            duration_minutes: durationMinutes,
            service_type: normalizeServiceType(form.service_type),
          });
        }
      } else {
        const dur = Number(form.drop_in_duration) || 30;
        for (const day of datesPayload) {
          for (const time of day.times || []) {
            const startsAt = new Date(day.date);
            const [hh, mm] = String(time).split(":").map(Number);
            startsAt.setHours(hh, mm, 0, 0);
            const endsAt = new Date(startsAt);
            endsAt.setMinutes(endsAt.getMinutes() + dur);
            slots.push({
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              duration_minutes: dur,
              service_type: normalizeServiceType(form.service_type),
            });
          }
        }
      }
      if (!slots.length) throw new Error("Select at least one service time.");
      const { error: sErr } = await supabase
        .from("booking_slots")
        .insert(slots.map((s) => ({ booking_id: booking.id, ...s })));
      if (sErr) throw sErr;
      if (selectedPetIds.length) {
        const { error: pErr } = await supabase
          .from("booking_pets")
          .insert(selectedPetIds.map((pet_id) => ({ booking_id: booking.id, pet_id })));
        if (pErr) throw pErr;
      }
      try {
        await fetch("/api/inbox/seed-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: booking.id }),
        });
      } catch {
        /* Inbox is also created when either person opens /inbox */
      }
      window.location.href = '/account?placed=1&booking=${booking.id}';
    } catch (err) {
      setError(err.message || "Could not submit booking");
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
            <GooglePlacesAutocomplete value={address} onChange={setAddress} placeholder="Type your address" />
            {address.formatted_address ? <p className="mt-1 text-xs text-[#7a5c4e]">{address.formatted_address}</p> : null}
          </label>
          <label className="block text-sm">
            <span className="font-medium">What service</span>
            <select
              className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              value={form.service_type}
              onChange={(e) => {
                setForm({ ...form, service_type: e.target.value });
                setDatesPayload([]);
              }}
            >
              {Object.values(SERVICE_TYPES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {timedService ? (
            <label className="block text-sm">
              <span className="font-medium">How long</span>
              <select
                className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
                value={form.drop_in_duration}
                onChange={(e) => setForm({ ...form, drop_in_duration: Number(e.target.value) })}
              >
                <option value={30}>30 minutes (base rate)</option>
                <option value={60}>60 minutes (base + 60-min add-on)</option>
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!hasAddress}
            className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Next
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="text-xl font-semibold">Step 2 — Date(s)</h2>
          {overnight ? (
            <p className="text-sm text-[#7a5c4e]">Choose start date and end date. You are charged per night (end date is checkout).</p>
          ) : null}
          {timedService ? (
            <p className="text-sm text-[#7a5c4e]">Select each visit day, then add a start time. Each time is one visit at the 30-minute base rate.</p>
          ) : null}
          <DatesStep value={datesPayload} onChange={setDatesPayload} serviceType={form.service_type} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!datesPayload.length || !houseSitDatesValid || !visitTimesValid}
              className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="text-xl font-semibold">Step 3 — Your pets</h2>
          <p className="text-sm text-[#7a5c4e]">The first pet is included. Each extra pet adds the sitter’s additional cat/dog rate.</p>
          <PetsStep customerId={customerId} selectedPetIds={selectedPetIds} onChange={setSelectedPetIds} />
          <label className="block text-sm">
            <span className="font-medium">Message</span>
            <textarea
              required
              className="mt-1 min-h-[80px] w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
              placeholder={DEFAULT_BOOKING_MESSAGE}
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
            />
          </label>
          <p className="text-xs text-[#7a5c4e]">This starts the chat with your sitter in Inbox.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">
              Back
            </button>
            <button type="button" onClick={() => setStep(4)} disabled={!messageReady} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              Next
            </button>
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <h2 className="text-xl font-semibold">Step 4 — Choose sitter</h2>
          {availableSitters.length === 0 ? (
            <p className="text-sm text-[#7a5c4e]">No sitters match. Confirm the service is enabled and the sitter radius is Anywhere or covers this address.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {availableSitters.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-3 py-2 text-sm">
                  <input type="radio" name="sitter_id" checked={form.sitter_id === s.id} onChange={() => setForm({ ...form, sitter_id: s.id })} />
                  <span>{s.display_name}</span>
                </label>
              ))}
            </div>
          )}
          {price ? <BookingPriceBreakdown breakdown={price} /> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(3)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">
              Back
            </button>
            <button
              type="button"
              onClick={submitBooking}
              disabled={submitting || !form.sitter_id || estimatedTotal <= 0 || !messageReady}
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
