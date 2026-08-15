export function ymdFromValue(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tzParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function wallTimeToUtcDate(dateStr, timeStr, timeZone) {
  const [year, month, day] = String(dateStr || "").split("-").map(Number);
  const [hour, minute] = String(timeStr || "00:00").split(":").map(Number);
  if (!year || !month || !day) return null;
  if (!timeZone) return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);

  let utc = Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0);
  for (let i = 0; i < 4; i++) {
    const shown = tzParts(new Date(utc), timeZone);
    const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const wantedUtc = Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0);
    const diff = wantedUtc - shownUtc;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

export function formatInTimezone(iso, timeZone) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  if (timeZone) return date.toLocaleString(undefined, { ...options, timeZone });
  return date.toLocaleString(undefined, options);
}

export function timezoneLabel(timeZone) {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
}

export function serviceLocationText(booking, sitter) {
  const type = booking?.service_type;
  if (type === "boarding") {
    const city = sitter?.service_city || booking?.sitters?.service_city;
    const country = sitter?.service_country || booking?.sitters?.service_country;
    return [city, country].filter(Boolean).join(", ") || "Sitter city";
  }
  return booking?.service_address
    || [booking?.service_address_city, booking?.service_address_state, booking?.service_address_country].filter(Boolean).join(", ")
    || "Service address";
}
