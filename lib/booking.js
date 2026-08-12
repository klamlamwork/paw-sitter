import { wallTimeToUtcDate, haversineKm } from "@/lib/locations";

export const SERVICE_TYPES = {
  house_sit: {
    id: "house_sit",
    label: "House sit",
    rateUnit: "night",
    description: "Overnight stay at the pet's home.",
    schedule: "range",
    petsOptional: true,
  },
  drop_in: {
    id: "drop_in",
    label: "Drop-in visit",
    rateUnit: "30 min",
    description: "Short visits for care at the pet's home.",
    schedule: "visits",
    petsOptional: true,
  },
  walking: {
    id: "walking",
    label: "Dog / cat walking",
    rateUnit: "30 min",
    description: "Walks for dogs and/or cats.",
    schedule: "visits",
    petsRequired: true,
  },
  boarding: {
    id: "boarding",
    label: "Boarding",
    rateUnit: "night",
    description: "Pets stay overnight at the sitter's place.",
    schedule: "range",
    petsRequired: true,
  },
};

/** null / 0 / negative => unlimited service area */
export function isUnlimitedRadius(radiusKm) {
  if (radiusKm == null || radiusKm === "") return true;
  const r = Number(radiusKm);
  return !Number.isFinite(r) || r <= 0;
}

export function dropInDurationOptions() {
  const opts = [];
  for (let m = 30; m <= 360; m += 30) {
    const hours = m / 60;
    opts.push({
      minutes: m,
      label: hours < 1 ? "30 min" : hours + " hr" + (hours > 1 ? "s" : ""),
    });
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

export function estimateHouseSitTotal({
  start,
  end,
  rateRegular,
  rateHoliday,
  holidaySet = new Set(),
}) {
  let total = 0,
    nights = 0;
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(12, 0, 0, 0);
  while (cursor < endDay) {
    const key = cursor.toISOString().slice(0, 10);
    total += Number(holidaySet.has(key) ? rateHoliday : rateRegular) || 0;
    nights++;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!nights) {
    nights = 1;
    total = Number(rateRegular) || 0;
  }
  return { total, nights };
}

export function estimateDropInVisitTotal({
  minutes,
  startsAt,
  rateRegular,
  rateHoliday,
  holidaySet = new Set(),
}) {
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

function weekScope(serviceType) {
  if (serviceType === "drop_in" || serviceType === "walking") return serviceType;
  return "default";
}

export function getEffectiveWindow(
  sitterId,
  dateObj,
  weeklyRows,
  overrideRows,
  timeZone,
  serviceType
) {
  const dateKey = toDateKey(dateObj, timeZone);
  const dayNum = timeZone
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(dateObj)
      )
    : dateObj.getDay();
  const ov = (overrideRows || []).find(
    (r) => r.sitter_id === sitterId && r.override_date === dateKey
  );
  if (ov) {
    if (!ov.is_available) return null;
    return {
      start: (ov.start_time || "00:00").slice(0, 5),
      end: (ov.end_time || "23:59").slice(0, 5),
    };
  }
  const scope = weekScope(serviceType);
  const rows = (weeklyRows || []).filter(
    (r) => r.sitter_id === sitterId && r.day_of_week === dayNum
  );
  const specific = rows.find((r) => (r.service_scope || "default") === scope);
  const fallback = rows.find((r) => (r.service_scope || "default") === "default");
  const w = specific || fallback;
  if (!w || !w.is_available) return null;
  return {
    start: (w.start_time || "09:00").slice(0, 5),
    end: (w.end_time || "17:00").slice(0, 5),
  };
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
  return (
    Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value || 0)
  );
}

export function fitsWindow(startsAt, endsAt, window, timeZone) {
  if (!window) return false;
  const startM = minutesInZone(startsAt, timeZone);
  const endM = minutesInZone(endsAt, timeZone);
  // Overnight / multi-day range: only require start within open hours
  if (endM < startM || endsAt - startsAt > 20 * 60 * 60 * 1000) {
    return startM >= timeToMinutes(window.start);
  }
  return startM >= timeToMinutes(window.start) && endM <= timeToMinutes(window.end);
}

export function overlapsBusy(startsAt, endsAt, busySlots) {
  const a = startsAt.getTime(),
    b = endsAt.getTime();
  return (busySlots || []).some(
    (s) => a < new Date(s.ends_at).getTime() && b > new Date(s.starts_at).getTime()
  );
}

export function serviceAvailableOnDay(
  sitterId,
  serviceType,
  dateObj,
  dayAvailability,
  timeZone
) {
  const dateKey = toDateKey(dateObj, timeZone);
  const dayRows = (dayAvailability || []).filter(
    (r) => r.sitter_id === sitterId && r.day === dateKey
  );
  if (dayRows.length === 0) return { hasOverride: false, available: true, window: null };
  const row = dayRows.find((r) => r.service_type === serviceType);
  if (!row || !row.is_available) return { hasOverride: true, available: false, window: null };
  return {
    hasOverride: true,
    available: true,
    window: {
      start: (row.start_time || "09:00").slice(0, 5),
      end: (row.end_time || "17:00").slice(0, 5),
    },
  };
}

function petsMatch(svc, petsDogs, petsCats) {
  const meta = SERVICE_TYPES[svc.service_type];
  if (!meta?.petsRequired) return true;
  if (!petsDogs && !petsCats) return false;
  if (petsDogs && svc.accepts_dogs === false) return false;
  if (petsCats && svc.accepts_cats === false) return false;
  return true;
}

function normPlace(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** Match by coordinates, unlimited radius, or same city/country name. */
function areaMatch(sitter, svc, customerLocation) {
  const unlimited = isUnlimitedRadius(svc.radius_km);
  let distanceKm = null;

  if (customerLocation?.lat == null || customerLocation?.lng == null) {
    return { ok: true, distanceKm: null, unlimited, via: "no_customer_coords" };
  }

  if (sitter.lat != null && sitter.lng != null) {
    distanceKm = haversineKm(
      customerLocation.lat,
      customerLocation.lng,
      sitter.lat,
      sitter.lng
    );
    if (unlimited) return { ok: true, distanceKm, unlimited: true, via: "unlimited" };
    const radius = Number(svc.radius_km);
    if (distanceKm != null && distanceKm <= radius + 0.05) {
      return { ok: true, distanceKm, unlimited: false, via: "radius" };
    }
    return { ok: false, distanceKm, unlimited: false, via: "outside_radius", reason: "outside_radius" };
  }

  // No sitter pin: allow unlimited, or same city (and country when both set)
  if (unlimited) return { ok: true, distanceKm: null, unlimited: true, via: "unlimited_no_pin" };

  const cCity = normPlace(customerLocation.city);
  const sCity = normPlace(sitter.service_city);
  const cCountry = normPlace(customerLocation.country || customerLocation.country_code);
  const sCountry = normPlace(sitter.service_country);

  if (cCity && sCity && cCity === sCity) {
    if (!cCountry || !sCountry || cCountry === sCountry || cCountry.length === 2) {
      return { ok: true, distanceKm: null, unlimited: false, via: "city_name" };
    }
  }

  return { ok: false, distanceKm: null, unlimited: false, via: "no_coords", reason: "no_coords" };
}

export function filterAvailableSitters({
  sitters,
  services,
  weekly,
  overrides,
  busyBySitter,
  dayAvailability,
  serviceType,
  slots,
  customerLocation,
  serviceTimezone,
  petsDogs = false,
  petsCats = false,
  preferredSitterId = "",
}) {
  const results = [];
  const preferredId = preferredSitterId ? String(preferredSitterId) : "";

  for (const sitter of sitters || []) {
    const svc = (services || []).find(
      (s) => s.sitter_id === sitter.id && s.service_type === serviceType && s.enabled
    );
    if (!svc) continue;
    if (!petsMatch(svc, petsDogs, petsCats)) continue;

    const area = areaMatch(sitter, svc, customerLocation);
    if (!area.ok) continue;

    const tz = serviceTimezone || customerLocation?.timezone || sitter.timezone;
    const busy = (busyBySitter && busyBySitter[sitter.id]) || [];
    const ok = (slots || []).every((slot) => {
      const dayInfo = serviceAvailableOnDay(
        sitter.id,
        serviceType,
        slot.startsAt,
        dayAvailability,
        tz
      );
      if (dayInfo.hasOverride && !dayInfo.available) return false;
      const win =
        dayInfo.hasOverride && dayInfo.window
          ? dayInfo.window
          : getEffectiveWindow(sitter.id, slot.startsAt, weekly, overrides, tz, serviceType);
      if (!fitsWindow(slot.startsAt, slot.endsAt, win, tz)) return false;
      if (overlapsBusy(slot.startsAt, slot.endsAt, busy)) return false;
      return true;
    });
    if (!ok) continue;

    results.push({
      ...sitter,
      _distanceKm: area.distanceKm,
      _radiusKm: area.unlimited ? null : Number(svc.radius_km),
      _unlimited: area.unlimited,
      _areaVia: area.via,
      _acceptsDogs: svc.accepts_dogs !== false,
      _acceptsCats: svc.accepts_cats !== false,
    });
  }

  results.sort((a, b) => {
    if (preferredId) {
      const ap = String(a.id) === preferredId ? 0 : 1;
      const bp = String(b.id) === preferredId ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    if (a._distanceKm == null && b._distanceKm == null) return 0;
    if (a._distanceKm == null) return 1;
    if (b._distanceKm == null) return -1;
    return a._distanceKm - b._distanceKm;
  });

  return results;
}

/** Human hints when the sitter list is empty (for UI). */
export function explainEmptySitterMatch({
  sitters,
  services,
  serviceType,
  customerLocation,
  slots,
  petsDogs,
  petsCats,
}) {
  const hints = [];
  const active = sitters || [];
  if (!active.length) {
    hints.push("No active sitters are loaded. Check admin sitters and RLS policies.");
    return hints;
  }
  const withService = active.filter((s) =>
    (services || []).some((x) => x.sitter_id === s.id && x.service_type === serviceType && x.enabled)
  );
  if (!withService.length) {
    hints.push(`No sitters have "${SERVICE_TYPES[serviceType]?.label || serviceType}" enabled.`);
    return hints;
  }
  if (!slots?.length) {
    hints.push("Set a valid schedule first.");
    return hints;
  }
  if (customerLocation?.lat == null) {
    hints.push("Select your city so we can match service areas.");
  }
  const meta = SERVICE_TYPES[serviceType];
  if (meta?.petsRequired && !petsDogs && !petsCats) {
    hints.push("Select dog and/or cat for this service.");
  }
  hints.push(
    "Try different times, or ask the sitter to set weekly hours and a map pin / city on their dashboard."
  );
  hints.push(
    "Sitters without a map pin are matched by city name when it matches yours (e.g. Cambridge)."
  );
  return hints;
}
