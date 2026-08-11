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
export function parseLocalDateTime(dateStr, timeStr) { return new Date(dateStr + "T" + timeStr + ":00"); }
export function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60000); }
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
export function toDateKey(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}
export function getEffectiveWindow(sitterId, dateObj, weeklyRows, overrideRows) {
  const dateKey = toDateKey(dateObj);
  const dow = dateObj.getDay();
  const ov = (overrideRows || []).find((r) => r.sitter_id === sitterId && r.override_date === dateKey);
  if (ov) {
    if (!ov.is_available) return null;
    return { start: (ov.start_time || "00:00").slice(0, 5), end: (ov.end_time || "23:59").slice(0, 5) };
  }
  const w = (weeklyRows || []).find((r) => r.sitter_id === sitterId && r.day_of_week === dow);
  if (!w || !w.is_available) return null;
  return { start: (w.start_time || "09:00").slice(0, 5), end: (w.end_time || "17:00").slice(0, 5) };
}
function timeToMinutes(t) {
  const p = t.slice(0, 5).split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}
export function fitsWindow(startsAt, endsAt, window) {
  if (!window) return false;
  const startM = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endM = endsAt.getHours() * 60 + endsAt.getMinutes();
  return startM >= timeToMinutes(window.start) && endM <= timeToMinutes(window.end);
}
export function overlapsBusy(startsAt, endsAt, busySlots) {
  const a = startsAt.getTime(), b = endsAt.getTime();
  return (busySlots || []).some((s) => a < new Date(s.ends_at).getTime() && b > new Date(s.starts_at).getTime());
}
export function serviceAvailableOnDay(sitterId, serviceType, dateObj, dayAvailability) {
  const dateKey = toDateKey(dateObj);
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
  sitters, services, weekly, overrides, busyBySitter, dayAvailability, serviceType, slots,
}) {
  return sitters.filter((sitter) => {
    const svc = services.find((s) => s.sitter_id === sitter.id && s.service_type === serviceType && s.enabled);
    if (!svc) return false;
    const busy = busyBySitter[sitter.id] || [];
    return slots.every((slot) => {
      const dayInfo = serviceAvailableOnDay(sitter.id, serviceType, slot.startsAt, dayAvailability);
      if (dayInfo.hasOverride && !dayInfo.available) return false;
      const win = dayInfo.hasOverride && dayInfo.window
        ? dayInfo.window
        : getEffectiveWindow(sitter.id, slot.startsAt, weekly, overrides);
      if (!fitsWindow(slot.startsAt, slot.endsAt, win)) return false;
      if (overlapsBusy(slot.startsAt, slot.endsAt, busy)) return false;
      return true;
    });
  });
}
