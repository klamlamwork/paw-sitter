import { haversineKm, wallTimeToUtcDate } from "@/lib/locations";

export const SERVICE_TYPES = {
  house_sit: { id: "house_sit", label: "House sit", rateUnit: "night", description: "Overnight stay at pet home." },
  drop_in: { id: "drop_in", label: "Drop-in visit", rateUnit: "30 min", description: "Short visits for care." },
};

export function dropInDurationOptions() {
  const opts = [];
  for (let m = 30; m <= 360; m += 30) {
    const hours = m / 60;
    opts.push({ minutes: m, label: hours < 1 ? "30 min" : hours + " hr" + (hours > 1 ? "s" : "") });
  }
  return opts;
}

export function parseLocalDateTime(dateStr, timeStr, timeZone) {
  if (timeZone) {
    const d = wallTimeToUtcDate(dateStr, timeStr, timeZone);
    if (d) return d;
  }
  return new Date(dateStr + "T" + timeStr + ":00");
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function estimateHouseSitTotal({ start, end, rateRegular, rateHoliday, holidaySet = new Set() }) {
  let total = 0, nights = 0;
  const cursor = new Date(start); cursor.setHours(12, 0, 0, 0);
  const endDay = new Date(end); endDay.setHours(12, 0, 0, 0);
  while (cursor < endDay) {
    const key = cursor.toISOString().slice(0, 10);
    total += Number(holidaySet.has(key) ? rateHoliday : rateRegular) || 0;
    nights++; cursor.setDate(cursor.getDate() + 1);
  }
  if (!nights) { nights = 1; total = Number(rateRegular) || 0; }
  return { total, nights };
}

export function estimateDropInVisitTotal({ minutes, startsAt, rateRegular, rateHoliday, holidaySet = new Set() }) {
  const blocks = Math.ceil(minutes / 30);
  const key = startsAt.toISOString().slice(0, 10);
  const rate = holidaySet.has(key) ? rateHoliday : rateRegular;
  return { total: blocks * (Number(rate) || 0), blocks };
}

export function toDateKey(dateObj, timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(dateObj);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return get("year") + "-" + get("month") + "-" + get("day");
  }
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

export function getEffectiveWindow(sitterId, dateObj, weeklyRows, overrideRows, timeZone) {
  const dateKey = toDateKey(dateObj, timeZone);
  const dayNum = timeZone
    ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(dateObj)
      )
    : dateObj.getDay();
  const ov = (overrideRows || []).find((r) => r.sitter_id === sitterId && r.override_date === dateKey);
  if (ov) {
    if (!ov.is_available) return null;
    return { start: (ov.start_time || "00:00").slice(0, 5), end: (ov.end_time || "23:59").slice(0, 5) };
  }
  const w = (weeklyRows || []).find((r) => r.sitter_id === sitterId && r.day_of_week === dayNum);
  if (!w || !w.is_available) return null;
  return { start: (w.start_time || "09:00").slice(0, 5), end: (w.end_time || "17:00").slice(0, 5) };
}

function timeToMinutes(t) {
  const p = t.slice(0, 5).split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}

function minutesInZone(dateObj, timeZone) {
  if (!timeZone) return dateObj.getHours() * 60 + dateObj.getMinutes();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dateObj);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

export function fitsWindow(startsAt, endsAt, window, timeZone) {
  if (!window) return false;
  const startM = minutesInZone(startsAt, timeZone);
  const endM = minutesInZone(endsAt, timeZone);
  if (endM < startM) return startM >= timeToMinutes(window.start);
  return startM >= timeToMinutes(window.start) && endM <= timeToMinutes(window.end);
}

export function overlapsBusy(startsAt, endsAt, busySlots) {
  const a = startsAt.getTime(), b = endsAt.getTime();
  return (busySlots || []).some((s) => a < new Date(s.ends_at).getTime() && b > new Date(s.starts_at).getTime());
}

export function serviceAvailableOnDay(sitterId, serviceType, dateObj, dayAvailability, timeZone) {
  const dateKey = toDateKey(dateObj, timeZone);
  const dayRows = (dayAvailability || []).filter((r) => r.sitter_id === sitterId && r.day === dateKey);
  if (dayRows.length === 0) return { hasOverride: false, available: true, window: null };
  const row = dayRows.find((r) => r.service_type === serviceType);
  if (!row || !row.is_available) return { hasOverride: true, available: false, window: null };
  return {
    hasOverride: true,
    available: true,
    window: { start: (row.start_time || "09:00").slice(0, 5), end: (row.end_time || "17:00").slice(0, 5) },
  };
}

export function filterAvailableSitters({
  sitters, services, weekly, overrides, busyBySitter, dayAvailability,
  serviceType, slots, customerLocation, serviceTimezone,
}) {
  const results = [];
  for (const sitter of sitters) {
    const svc = services.find((s) => s.sitter_id === sitter.id && s.service_type === serviceType && s.enabled);
    if (!svc) continue;

    let distanceKm = null;
    if (customerLocation?.lat != null && customerLocation?.lng != null) {
      if (sitter.lat == null || sitter.lng == null) continue;
      distanceKm = haversineKm(customerLocation.lat, customerLocation.lng, sitter.lat, sitter.lng);
      const radius = Number(svc.radius_km ?? 15);
      if (distanceKm == null || distanceKm > radius + 0.05) continue;
    }

    const tz = serviceTimezone || customerLocation?.timezone || sitter.timezone;
    const busy = busyBySitter[sitter.id] || [];
    const ok = slots.every((slot) => {
      const dayInfo = serviceAvailableOnDay(sitter.id, serviceType, slot.startsAt, dayAvailability, tz);
      if (dayInfo.hasOverride && !dayInfo.available) return false;
      const win = dayInfo.hasOverride && dayInfo.window
        ? dayInfo.window
        : getEffectiveWindow(sitter.id, slot.startsAt, weekly, overrides, tz);
      if (!fitsWindow(slot.startsAt, slot.endsAt, win, tz)) return false;
      if (overlapsBusy(slot.startsAt, slot.endsAt, busy)) return false;
      return true;
    });
    if (!ok) continue;
    results.push({ ...sitter, _distanceKm: distanceKm, _radiusKm: Number(svc.radius_km ?? 15) });
  }
  results.sort((a, b) => {
    if (a._distanceKm == null || b._distanceKm == null) return 0;
    return a._distanceKm - b._distanceKm;
  });
  return results;
}
