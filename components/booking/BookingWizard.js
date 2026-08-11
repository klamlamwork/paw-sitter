"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  SERVICE_TYPES, dropInDurationOptions, parseLocalDateTime, addMinutes,
  estimateHouseSitTotal, estimateDropInVisitTotal, filterAvailableSitters,
} from "@/lib/booking";
import { locationLabel, formatInTimezone } from "@/lib/locations";
import LocationPicker from "@/components/LocationPicker";

const steps = ["Location", "Service", "Schedule", "Sitter", "Confirm"];

export default function BookingWizard({
  customerId, customerProfile, sitters, services, weekly, overrides,
  busyBySitter, dayAvailability, holidayDates,
}) {
  const router = useRouter();
  const holidaySet = useMemo(() => new Set(holidayDates || []), [holidayDates]);
  const [custLoc, setCustLoc] = useState(() =>
    customerProfile?.location_id
      ? {
          location_id: customerProfile.location_id, city: customerProfile.city,
          country: customerProfile.country, country_code: customerProfile.country_code,
          timezone: customerProfile.timezone, lat: customerProfile.lat, lng: customerProfile.lng,
        }
      : null
  );
  const [step, setStep] = useState(custLoc?.lat != null ? 1 : 0);
  const [serviceType, setServiceType] = useState("drop_in");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hsDate, setHsDate] = useState("");
  const [hsStartTime, setHsStartTime] = useState("17:00");
  const [hsEndDate, setHsEndDate] = useState("");
  const [hsEndTime, setHsEndTime] = useState("10:00");
  const [visits, setVisits] = useState([{ date: "", startTime: "10:00", durationMinutes: 30 }]);
  const [selectedSitterId, setSelectedSitterId] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const tz = custLoc?.timezone || undefined;

  const slots = useMemo(() => {
    try {
      if (serviceType === "house_sit") {
        if (!hsDate || !hsEndDate) return [];
        const startsAt = parseLocalDateTime(hsDate, hsStartTime, tz);
        const endsAt = parseLocalDateTime(hsEndDate, hsEndTime, tz);
        if (!(endsAt > startsAt)) return [];
        return [{ startsAt, endsAt }];
      }
      return visits.filter((v) => v.date && v.startTime).map((v) => {
        const startsAt = parseLocalDateTime(v.date, v.startTime, tz);
        return { startsAt, endsAt: addMinutes(startsAt, Number(v.durationMinutes)), durationMinutes: Number(v.durationMinutes) };
      });
    } catch { return []; }
  }, [serviceType, hsDate, hsStartTime, hsEndDate, hsEndTime, visits, tz]);

  const availableSitters = useMemo(() => {
    if (!slots.length || !custLoc?.lat) return [];
    return filterAvailableSitters({
      sitters, services, weekly, overrides, busyBySitter, dayAvailability,
      serviceType, slots, customerLocation: custLoc, serviceTimezone: tz,
    });
  }, [sitters, services, weekly, overrides, busyBySitter, dayAvailability, serviceType, slots, custLoc, tz]);

  const selectedSitter = availableSitters.find((s) => s.id === selectedSitterId) || sitters.find((s) => s.id === selectedSitterId);
  const selectedService = services.find((s) => s.sitter_id === selectedSitterId && s.service_type === serviceType);

  const estimate = useMemo(() => {
    if (!selectedService || !slots.length) return { total: 0, detail: "" };
    if (serviceType === "house_sit") {
      const r = estimateHouseSitTotal({ start: slots[0].startsAt, end: slots[0].endsAt, rateRegular: selectedService.rate_regular, rateHoliday: selectedService.rate_holiday, holidaySet });
      return { total: r.total, detail: r.nights + " night(s)" };
    }
    let total = 0;
    for (const slot of slots) {
      total += estimateDropInVisitTotal({ minutes: slot.durationMinutes, startsAt: slot.startsAt, rateRegular: selectedService.rate_regular, rateHoliday: selectedService.rate_holiday, holidaySet }).total;
    }
    return { total, detail: slots.length + " visit(s)" };
  }, [selectedService, slots, serviceType, holidaySet]);

  async function persistCustomerLocation() {
    if (!custLoc?.location_id) return;
    const supabase = createClient();
    await supabase.from("profiles").update({
      location_id: custLoc.location_id, city: custLoc.city, country: custLoc.country,
      country_code: custLoc.country_code, timezone: custLoc.timezone, lat: custLoc.lat, lng: custLoc.lng,
    }).eq("id", customerId);
  }

  function nextStep() {
    setError("");
    if (step === 0) {
      if (!custLoc?.lat) { setError("Select your city so we can match sitters in your area."); return; }
      persistCustomerLocation();
    }
    if (step === 2 && !slots.length) { setError("Set valid date and time (in your city timezone)."); return; }
    if (step === 3 && !selectedSitterId) { setError("Choose a sitter."); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function submitBooking() {
    setSaving(true); setError("");
    const supabase = createClient();
    try {
      await persistCustomerLocation();
      const slotRows = slots.map((slot) => {
        let duration_minutes, line_total;
        if (serviceType === "house_sit") {
          duration_minutes = Math.round((slot.endsAt - slot.startsAt) / 60000);
          line_total = estimateHouseSitTotal({ start: slot.startsAt, end: slot.endsAt, rateRegular: selectedService.rate_regular, rateHoliday: selectedService.rate_holiday, holidaySet }).total;
        } else {
          duration_minutes = slot.durationMinutes;
          line_total = estimateDropInVisitTotal({ minutes: slot.durationMinutes, startsAt: slot.startsAt, rateRegular: selectedService.rate_regular, rateHoliday: selectedService.rate_holiday, holidaySet }).total;
        }
        return { starts_at: slot.startsAt.toISOString(), ends_at: slot.endsAt.toISOString(), duration_minutes, unit_rate: selectedService.rate_regular, line_total };
      });
      const estimated_total = slotRows.reduce((s, r) => s + Number(r.line_total || 0), 0);
      const { data: booking, error: bErr } = await supabase.from("bookings").insert({
        customer_id: customerId, sitter_id: selectedSitterId, service_type: serviceType, status: "pending",
        pet_notes: petNotes, customer_notes: customerNotes, estimated_total, currency: "CAD",
      }).select("id").single();
      if (bErr) throw bErr;
      const { error: sErr } = await supabase.from("booking_slots").insert(slotRows.map((r) => ({ ...r, booking_id: booking.id })));
      if (sErr) throw sErr;
      router.push("/account?booked=1");
      router.refresh();
    } catch (e) {
      setError(e.message || "Could not create booking.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      <ol className="mb-8 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li key={label} className={"rounded-full px-3 py-1 text-xs font-semibold " + (i === step ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#7a5c4e]")}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {step === 0 && (
        <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
          <h2 className="font-semibold text-[#3b2a22]">Where do you need pet sitting?</h2>
          <p className="mt-1 text-sm text-[#7a5c4e]">Choose city from the shared list. Times use that timezone; only sitters covering this area appear.</p>
          <div className="mt-4"><LocationPicker valueId={custLoc?.location_id || ""} onChange={setCustLoc} /></div>
          {custLoc ? <p className="mt-3 text-sm text-[#5c4033]">Service location: <strong>{locationLabel(custLoc)}</strong> ({custLoc.timezone})</p> : null}
          <p className="mt-2 text-xs text-[#7a5c4e]">Also under <Link href="/account" className="font-semibold text-[#c45c26] hover:underline">Account</Link>.</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.values(SERVICE_TYPES).map((svc) => (
            <button key={svc.id} type="button" onClick={() => setServiceType(svc.id)} className={"rounded-2xl border p-5 text-left " + (serviceType === svc.id ? "border-[#c45c26] bg-[#fff8f0]" : "border-[#e8d5c4] bg-white")}>
              <h2 className="text-lg font-semibold">{svc.label}</h2>
              <p className="mt-1 text-sm text-[#7a5c4e]">{svc.description}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-3 text-xs text-[#7a5c4e]">Times are in <strong>{tz || "your local"}</strong> ({locationLabel(custLoc)}).</p>
          {serviceType === "house_sit" ? (
            <div className="grid gap-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 sm:grid-cols-2">
              <label className="text-sm">Start date<input type="date" value={hsDate} onChange={(e) => setHsDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
              <label className="text-sm">Start time<input type="time" value={hsStartTime} onChange={(e) => setHsStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
              <label className="text-sm">End date<input type="date" value={hsEndDate} onChange={(e) => setHsEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
              <label className="text-sm">End time<input type="time" value={hsEndTime} onChange={(e) => setHsEndTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
              <div className="flex justify-between">
                <h2 className="font-semibold">Drop-in visits</h2>
                <button type="button" className="text-sm font-semibold text-[#c45c26]" onClick={() => setVisits((v) => [...v, { date: "", startTime: "10:00", durationMinutes: 30 }])}>+ Add visit</button>
              </div>
              {visits.map((v, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-[#e8d5c4] bg-white p-3 sm:grid-cols-4">
                  <input type="date" value={v.date} onChange={(e) => setVisits((list) => list.map((row, idx) => (idx === i ? { ...row, date: e.target.value } : row)))} className="rounded-lg border border-[#e8d5c4] px-2 py-2" />
                  <input type="time" value={v.startTime} onChange={(e) => setVisits((list) => list.map((row, idx) => (idx === i ? { ...row, startTime: e.target.value } : row)))} className="rounded-lg border border-[#e8d5c4] px-2 py-2" />
                  <select value={v.durationMinutes} onChange={(e) => setVisits((list) => list.map((row, idx) => (idx === i ? { ...row, durationMinutes: Number(e.target.value) } : row)))} className="rounded-lg border border-[#e8d5c4] px-2 py-2">
                    {dropInDurationOptions().map((o) => <option key={o.minutes} value={o.minutes}>{o.label}</option>)}
                  </select>
                  <button type="button" onClick={() => setVisits((list) => (list.length <= 1 ? list : list.filter((_, idx) => idx !== i)))} className="rounded-lg border border-[#e8d5c4] px-2 py-2 text-sm">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-[#7a5c4e]">
            Showing sitters whose <strong>{SERVICE_TYPES[serviceType]?.label}</strong> area covers <strong>{locationLabel(custLoc)}</strong>.
          </p>
          {availableSitters.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e8d5c4] p-6 text-sm text-[#7a5c4e]">
              No sitters cover this area for the selected service and times. Try another time, or ask a sitter to expand their km radius.
            </p>
          ) : availableSitters.map((s) => {
            const svc = services.find((x) => x.sitter_id === s.id && x.service_type === serviceType);
            return (
              <button key={s.id} type="button" onClick={() => setSelectedSitterId(s.id)} className={"w-full rounded-2xl border p-4 text-left " + (selectedSitterId === s.id ? "border-[#c45c26] bg-[#fff8f0]" : "border-[#e8d5c4] bg-white")}>
                <h3 className="font-semibold">{s.display_name}</h3>
                <p className="text-xs text-[#7a5c4e]">
                  Base: {s.service_city}, {s.service_country}
                  {s._distanceKm != null ? ` · ~${s._distanceKm.toFixed(1)} km away` : ""}
                  {s._radiusKm != null ? ` · covers ${s._radiusKm} km` : ""}
                </p>
                <p className="mt-1 text-sm">{s.bio || "No bio yet."}</p>
                {svc ? <p className="mt-1 text-xs font-medium text-[#c45c26]">${svc.rate_regular} regular / ${svc.rate_holiday} holiday</p> : null}
              </button>
            );
          })}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 text-sm">
          <p><strong>Location:</strong> {locationLabel(custLoc)} ({tz})</p>
          <p><strong>Service:</strong> {SERVICE_TYPES[serviceType]?.label}</p>
          <p><strong>Sitter:</strong> {selectedSitter?.display_name}</p>
          <p><strong>Estimate:</strong> ${estimate.total.toFixed(2)} CAD ({estimate.detail})</p>
          <ul className="space-y-1 text-[#5c4033]">
            {slots.map((slot, i) => (
              <li key={i}>{formatInTimezone(slot.startsAt, tz)} → {formatInTimezone(slot.endsAt, tz)}</li>
            ))}
          </ul>
          <textarea value={petNotes} onChange={(e) => setPetNotes(e.target.value)} rows={3} placeholder="Pet notes" className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
          <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} placeholder="Message" className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2" />
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <button type="button" disabled={step === 0 || saving} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40">Back</button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={nextStep} className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white">Continue</button>
        ) : (
          <button type="button" disabled={saving} onClick={submitBooking} className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Sending..." : "Request booking"}</button>
        )}
      </div>
    </div>
  );
}
