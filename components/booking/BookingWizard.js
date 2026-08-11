"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SERVICE_TYPES, dropInDurationOptions, parseLocalDateTime, addMinutes,
  estimateHouseSitTotal, estimateDropInVisitTotal, filterAvailableSitters,
} from "@/lib/booking";
const steps = ["Service", "Schedule", "Sitter", "Confirm"];
export default function BookingWizard({
  customerId, sitters, services, weekly, overrides, busyBySitter, holidayDates,
}) {
  const router = useRouter();
  const holidaySet = useMemo(() => new Set(holidayDates || []), [holidayDates]);
  const [step, setStep] = useState(0);
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
  const slots = useMemo(() => {
    try {
      if (serviceType === "house_sit") {
        if (!hsDate || !hsEndDate) return [];
        const startsAt = parseLocalDateTime(hsDate, hsStartTime);
        const endsAt = parseLocalDateTime(hsEndDate, hsEndTime);
        if (!(endsAt > startsAt)) return [];
        return [{ startsAt, endsAt }];
      }
      return visits.filter((v) => v.date && v.startTime).map((v) => {
        const startsAt = parseLocalDateTime(v.date, v.startTime);
        return { startsAt, endsAt: addMinutes(startsAt, Number(v.durationMinutes)), durationMinutes: Number(v.durationMinutes) };
      });
    } catch { return []; }
  }, [serviceType, hsDate, hsStartTime, hsEndDate, hsEndTime, visits]);
  const availableSitters = useMemo(() => {
    if (!slots.length) return [];
    return filterAvailableSitters({ sitters, services, weekly, overrides, busyBySitter, serviceType, slots });
  }, [sitters, services, weekly, overrides, busyBySitter, serviceType, slots]);
  const selectedSitter = sitters.find((s) => s.id === selectedSitterId);
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
  function nextStep() {
    setError("");
    if (step === 1 && !slots.length) { setError("Set valid date and time."); return; }
    if (step === 2 && !selectedSitterId) { setError("Choose a sitter."); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  async function submitBooking() {
    setSaving(true); setError("");
    const supabase = createClient();
    try {
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
          <li key={label} className={"rounded-full px-3 py-1 text-xs font-semibold " + (i === step ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#7a5c4e]")}>{i + 1}. {label}</li>
        ))}
      </ol>
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.values(SERVICE_TYPES).map((svc) => (
            <button key={svc.id} type="button" onClick={() => setServiceType(svc.id)} className={"rounded-2xl border p-5 text-left " + (serviceType === svc.id ? "border-[#c45c26] bg-[#fff8f0]" : "border-[#e8d5c4] bg-white")}>
              <h2 className="text-lg font-semibold">{svc.label}</h2>
              <p className="mt-1 text-sm text-[#7a5c4e]">{svc.description}</p>
            </button>
          ))}
        </div>
      )}
      {step === 1 && serviceType === "house_sit" && (
        <div className="grid gap-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 sm:grid-cols-2">
          <label className="text-sm">Start date<input type="date" value={hsDate} onChange={(e) => setHsDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
          <label className="text-sm">Start time<input type="time" value={hsStartTime} onChange={(e) => setHsStartTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
          <label className="text-sm">End date<input type="date" value={hsEndDate} onChange={(e) => setHsEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
          <label className="text-sm">End time<input type="time" value={hsEndTime} onChange={(e) => setHsEndTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2" /></label>
        </div>
      )}
      {step === 1 && serviceType === "drop_in" && (
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
      {step === 2 && (
        <div className="space-y-3">
          {availableSitters.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#e8d5c4] p-6 text-sm text-[#7a5c4e]">No sitters available. Add sitters in Admin first.</p>
          ) : availableSitters.map((s) => {
            const svc = services.find((x) => x.sitter_id === s.id && x.service_type === serviceType);
            return (
              <button key={s.id} type="button" onClick={() => setSelectedSitterId(s.id)} className={"w-full rounded-2xl border p-4 text-left " + (selectedSitterId === s.id ? "border-[#c45c26] bg-[#fff8f0]" : "border-[#e8d5c4] bg-white")}>
                <h3 className="font-semibold">{s.display_name}</h3>
                <p className="text-xs text-[#7a5c4e]">{s.service_city}, {s.service_country}</p>
                <p className="mt-1 text-sm">{s.bio || "No bio yet."}</p>
                {svc ? <p className="mt-1 text-xs font-medium text-[#c45c26]">${svc.rate_regular} regular / ${svc.rate_holiday} holiday</p> : null}
              </button>
            );
          })}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5 text-sm">
          <p><strong>Service:</strong> {SERVICE_TYPES[serviceType]?.label}</p>
          <p><strong>Sitter:</strong> {selectedSitter?.display_name}</p>
          <p><strong>Estimate:</strong> ${estimate.total.toFixed(2)} CAD ({estimate.detail})</p>
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
