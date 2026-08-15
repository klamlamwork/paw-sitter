"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortPreferredFirst } from "./preferredSitter";
import { estimateHouseSitTotal, estimateDropInVisitTotal } from "@/lib/booking";
import GooglePlacesAutocomplete from "./GooglePlacesAutocomplete";
import DatesStep from "./DatesStep";
import PetsStep from "./PetsStep";

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
  const [address, setAddress] = useState({ formatted_address: "", lat: null, lng: null, city: "", state: "", postal_code: "", country: "" });
  const [datesPayload, setDatesPayload] = useState([]);
  const [selectedPetIds, setSelectedPetIds] = useState([]);
  const [customerMessage, setCustomerMessage] = useState("");

  const [form, setForm] = useState({
    service_type: "house_sit",
    drop_in_duration: 60,
    sitter_id: preferredSitterId || "",
    payment_method: "later",
  });

  const holidaySet = new Set(holidayDates || []);
  const sitterServicesMap = {};
  for (const s of services || []) {
    if (!sitterServicesMap[s.sitter_id]) sitterServicesMap[s.sitter_id] = [];
    sitterServicesMap[s.sitter_id].push(s);
  }

  const availableSitters = (() => {
    if (!address.city || !form.service_type || datesPayload.length === 0) return [];
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
    if (datesPayload.length === 0 || !form.sitter_id) return 0;
    const sitter = (sitters || []).find((s) => String(s.id) === String(form.sitter_id));
    if (!sitter) return 0;
    const svc = (sitterServicesMap[sitter.id] || []).find(
      (x) => x.service_type === form.service_type && x.enabled
    );
    if (!svc) return 0;

    if (form.service_type === "house_sit") {
      if (!datesPayload.startTime || !datesPayload.endTime) return 0;
      const start = new Date(datesPayload[0].date);
      const end = new Date(datesPayload[datesPayload.length - 1].date);
      end.setDate(end.getDate() + 1);
      const [sh, sm] = (datesPayload.startTime || "12:00").split(":").map(Number);
      const [eh, em] = (datesPayload.endTime || "12:00").split(":").map(Number);
      start.setHours(sh, sm, 0, 0);
      end.setHours(eh, em, 0, 0);
      const { total } = estimateHouseSitTotal({
        start,
        end,
        rateRegular: svc.rate_regular,
        rateHoliday: svc.rate_holiday,
        holidaySet,
      });
      return total;
    }

    let total = 0;
    const dur = Number(form.drop_in_duration) || 60;
    for (const day of datesPayload) {
      const startsAt = new Date(day.date);
      for (const _ of day.times || []) {
        const { total: t } = estimateDropInVisitTotal({
          minutes: dur,
          startsAt,
          rateRegular: svc.rate_regular,
          rateHoliday: svc.rate_holiday,
          holidaySet,
        });
        total += t;
      }
    }
    return total;
  })();

  async function submitBooking() {
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();

      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          sitter_id: form.sitter_id,
          service_type: form.service_type,
          status: "pending",
          payment_method: "later",
          payment_status: "pending",
          estimated_total: estimatedTotal,
          service_address: address.formatted_address,
          service_address_lat: address.lat,
          service_address_lng: address.lng,
          service_address_city: address.city,
          service_address_state: address.state,
          service_address_postal_code: address.postal_code,
          service_address_country: address.country,
          customer_message: customerMessage || null,
          customer_notes: "",
          pet_notes: "",
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const slots = [];
      if (form.service_type === "house_sit") {
        if (datesPayload.length >= 2 && datesPayload.startTime && datesPayload.endTime) {
          const start = new Date(datesPayload[0].date);
          const end = new Date(datesPayload[datesPayload.length - 1].date);
          end.setDate(end.getDate() + 1);
          const [sh, sm] = (datesPayload.startTime || "12:00").split(":").map(Number);
          const [eh, em] = (datesPayload.endTime || "12:00").split(":").map(Number);
          start.setHours(sh, sm, 0, 0);
          end.setHours(eh, em, 0, 0);
          const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
          slots.push({ starts_at: start.toISOString(), ends_at: end.toISOString(), duration_minutes: durationMinutes, service_type: form.service_type });
        }
      } else {
        const dur = Number(form.drop_in_duration) || 60;
        for (const day of datesPayload) {
          const base = new Date(day.date);
          for (const t of day.times || []) {
            const [hh, mm] = t.split(":").map(Number);
            const startsAt = new Date(base);
            startsAt.setHours(hh, mm, 0, 0);
            const endsAt = new Date(startsAt);
            endsAt.setMinutes(endsAt.getMinutes() + dur);
            slots.push({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: dur, service_type: form.service_type });
          }
        }
      }

      if (!slots.length) throw new Error("Select at least one service time.");
      const { error: sErr } = await supabase.from("booking_slots").insert(
        slots.map((s) => ({ booking_id: booking.id, ...s }))
      );
      if (sErr) throw sErr;

      if (selectedPetIds.length) {
        const { error: pErr } = await supabase.from("booking_pets").insert(
          selectedPetIds.map((pet_id) => ({ booking_id: booking.id, pet_id }))
        );
        if (pErr) throw pErr;
      }

      window.location.href = `/booking?placed=1&booking=${booking.id}`;
    } catch (err) {
      setError(err.message || "Could not place booking");
    } finally {
      setSubmitting(false);
    }
  }

  const houseSitDatesValid = form.service_type !== "house_sit" || (datesPayload.length >= 2 && datesPayload.startTime && datesPayload.endTime);
  const visitTimesValid = form.service_type === "house_sit" || datesPayload.some((d) => (d.times || []).length > 0);

  return (
    <form className="mt-6 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {step === 1 && <>
        <h2 className="text-xl font-semibold">Step 1 — Where & service</h2>
        <label className="block text-sm"><span className="font-medium">Where</span>
          <GooglePlacesAutocomplete value={address} onChange={setAddress} placeholder="Type your address" />
          {address.formatted_address && <p className="mt-1 text-xs text-[#7a5c4e]">{address.formatted_address}</p>}
        </label>
        <label className="block text-sm"><span className="font-medium">What service</span>
          <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
            <option value="house_sit">House sit</option><option value="drop_in">Drop-in visits</option><option value="dog_walking">Dog walking</option><option value="boarding">Boarding</option>
          </select>
        </label>
        {(form.service_type === "drop_in" || form.service_type === "dog_walking") && <label className="block text-sm"><span className="font-medium">How long</span>
          <select className="mt-1 w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" value={form.drop_in_duration} onChange={(e) => setForm({ ...form, drop_in_duration: Number(e.target.value) })}>
            <option value={30}>30 minutes</option><option value={60}>60 minutes</option>
          </select>
        </label>}
        <button type="button" onClick={() => setStep(2)} disabled={!address.city} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Next</button>
      </>}
      {step === 2 && <>
        <h2 className="text-xl font-semibold">Step 2 — Date(s)</h2>
        {form.service_type === "house_sit" && <p className="text-sm text-[#7a5c4e]">Choose start date and end date for an overnight house sit (consecutive nights).</p>}
        <DatesStep value={datesPayload} onChange={setDatesPayload} serviceType={form.service_type} />
        <div className="flex gap-2"><button type="button" onClick={() => setStep(1)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button><button type="button" onClick={() => setStep(3)} disabled={!datesPayload.length || !houseSitDatesValid || !visitTimesValid} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Next</button></div>
      </>}
      {step === 3 && <>
        <h2 className="text-xl font-semibold">Step 3 — Your pets</h2>
        <PetsStep customerId={customerId} selectedPetIds={selectedPetIds} onChange={setSelectedPetIds} />
        <label className="block text-sm"><span className="font-medium">Message (optional)</span>
          <textarea className="mt-1 min-h-[80px] w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm" placeholder="Share any details the sitter should know (gate code, pet quirks, etc.)" value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} />
        </label>
        <div className="flex gap-2"><button type="button" onClick={() => setStep(2)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button><button type="button" onClick={() => setStep(4)} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white">Next</button></div>
      </>}
      {step === 4 && <>
        <h2 className="text-xl font-semibold">Step 4 — Choose sitter</h2>
        {availableSitters.length === 0 ? <p className="text-sm text-[#7a5c4e]">No sitters match. Adjust address or dates.</p> : <div className="grid gap-2 sm:grid-cols-2">{availableSitters.map((s) => <label key={s.id} className="flex items-center gap-2 rounded-xl border border-[#e8d5c4] bg-[#fff8f0] px-3 py-2 text-sm"><input type="radio" name="sitter_id" checked={form.sitter_id === s.id} onChange={() => setForm({ ...form, sitter_id: s.id })} /><span>{s.display_name}</span></label>)}</div>}
        {form.sitter_id && estimatedTotal > 0 ? (
          <p className="text-sm text-[#7a5c4e]">Estimated total: <strong>${(estimatedTotal / 100).toFixed(2)}</strong></p>
        ) : null}
        <div className="flex gap-2"><button type="button" onClick={() => setStep(3)} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Back</button><button type="button" onClick={submitBooking} disabled={submitting || !form.sitter_id || estimatedTotal <= 0} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Working…" : "Submit booking request"}</button></div>
      </>}
    </form>
  );
}
