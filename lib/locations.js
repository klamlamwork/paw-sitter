/** Shared location catalog + geo helpers (aligned city/country/timezone). */
export const LOCATIONS = [
  { id: "ca-vancouver", city: "Vancouver", country: "Canada", countryCode: "CA", lat: 49.2827, lng: -123.1207, timezone: "America/Vancouver" },
  { id: "ca-burnaby", city: "Burnaby", country: "Canada", countryCode: "CA", lat: 49.2488, lng: -122.9805, timezone: "America/Vancouver" },
  { id: "ca-richmond", city: "Richmond", country: "Canada", countryCode: "CA", lat: 49.1666, lng: -123.1336, timezone: "America/Vancouver" },
  { id: "ca-surrey", city: "Surrey", country: "Canada", countryCode: "CA", lat: 49.1913, lng: -122.849, timezone: "America/Vancouver" },
  { id: "ca-coquitlam", city: "Coquitlam", country: "Canada", countryCode: "CA", lat: 49.2838, lng: -122.7932, timezone: "America/Vancouver" },
  { id: "ca-victoria", city: "Victoria", country: "Canada", countryCode: "CA", lat: 48.4284, lng: -123.3656, timezone: "America/Vancouver" },
  { id: "ca-kelowna", city: "Kelowna", country: "Canada", countryCode: "CA", lat: 49.888, lng: -119.496, timezone: "America/Vancouver" },
  { id: "ca-calgary", city: "Calgary", country: "Canada", countryCode: "CA", lat: 51.0447, lng: -114.0719, timezone: "America/Edmonton" },
  { id: "ca-edmonton", city: "Edmonton", country: "Canada", countryCode: "CA", lat: 53.5461, lng: -113.4938, timezone: "America/Edmonton" },
  { id: "ca-saskatoon", city: "Saskatoon", country: "Canada", countryCode: "CA", lat: 52.1332, lng: -106.67, timezone: "America/Regina" },
  { id: "ca-regina", city: "Regina", country: "Canada", countryCode: "CA", lat: 50.4452, lng: -104.6189, timezone: "America/Regina" },
  { id: "ca-winnipeg", city: "Winnipeg", country: "Canada", countryCode: "CA", lat: 49.8951, lng: -97.1384, timezone: "America/Winnipeg" },
  { id: "ca-toronto", city: "Toronto", country: "Canada", countryCode: "CA", lat: 43.6532, lng: -79.3832, timezone: "America/Toronto" },
  { id: "ca-mississauga", city: "Mississauga", country: "Canada", countryCode: "CA", lat: 43.589, lng: -79.6441, timezone: "America/Toronto" },
  { id: "ca-brampton", city: "Brampton", country: "Canada", countryCode: "CA", lat: 43.7315, lng: -79.7624, timezone: "America/Toronto" },
  { id: "ca-ottawa", city: "Ottawa", country: "Canada", countryCode: "CA", lat: 45.4215, lng: -75.6972, timezone: "America/Toronto" },
  { id: "ca-hamilton", city: "Hamilton", country: "Canada", countryCode: "CA", lat: 43.2557, lng: -79.8711, timezone: "America/Toronto" },
  { id: "ca-london-on", city: "London", country: "Canada", countryCode: "CA", lat: 42.9849, lng: -81.2453, timezone: "America/Toronto" },
  { id: "ca-kitchener", city: "Kitchener", country: "Canada", countryCode: "CA", lat: 43.4516, lng: -80.4925, timezone: "America/Toronto" },
  { id: "ca-montreal", city: "Montreal", country: "Canada", countryCode: "CA", lat: 45.5017, lng: -73.5673, timezone: "America/Toronto" },
  { id: "ca-quebec-city", city: "Quebec City", country: "Canada", countryCode: "CA", lat: 46.8139, lng: -71.208, timezone: "America/Toronto" },
  { id: "ca-halifax", city: "Halifax", country: "Canada", countryCode: "CA", lat: 44.6488, lng: -63.5752, timezone: "America/Halifax" },
  { id: "ca-st-johns", city: "St. John's", country: "Canada", countryCode: "CA", lat: 47.5615, lng: -52.7126, timezone: "America/St_Johns" },
  { id: "us-seattle", city: "Seattle", country: "United States", countryCode: "US", lat: 47.6062, lng: -122.3321, timezone: "America/Los_Angeles" },
  { id: "us-portland", city: "Portland", country: "United States", countryCode: "US", lat: 45.5152, lng: -122.6784, timezone: "America/Los_Angeles" },
  { id: "us-san-francisco", city: "San Francisco", country: "United States", countryCode: "US", lat: 37.7749, lng: -122.4194, timezone: "America/Los_Angeles" },
  { id: "us-los-angeles", city: "Los Angeles", country: "United States", countryCode: "US", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" },
  { id: "us-san-diego", city: "San Diego", country: "United States", countryCode: "US", lat: 32.7157, lng: -117.1611, timezone: "America/Los_Angeles" },
  { id: "us-denver", city: "Denver", country: "United States", countryCode: "US", lat: 39.7392, lng: -104.9903, timezone: "America/Denver" },
  { id: "us-phoenix", city: "Phoenix", country: "United States", countryCode: "US", lat: 33.4484, lng: -112.074, timezone: "America/Phoenix" },
  { id: "us-chicago", city: "Chicago", country: "United States", countryCode: "US", lat: 41.8781, lng: -87.6298, timezone: "America/Chicago" },
  { id: "us-dallas", city: "Dallas", country: "United States", countryCode: "US", lat: 32.7767, lng: -96.797, timezone: "America/Chicago" },
  { id: "us-houston", city: "Houston", country: "United States", countryCode: "US", lat: 29.7604, lng: -95.3698, timezone: "America/Chicago" },
  { id: "us-minneapolis", city: "Minneapolis", country: "United States", countryCode: "US", lat: 44.9778, lng: -93.265, timezone: "America/Chicago" },
  { id: "us-new-york", city: "New York", country: "United States", countryCode: "US", lat: 40.7128, lng: -74.006, timezone: "America/New_York" },
  { id: "us-boston", city: "Boston", country: "United States", countryCode: "US", lat: 42.3601, lng: -71.0589, timezone: "America/New_York" },
  { id: "us-washington-dc", city: "Washington", country: "United States", countryCode: "US", lat: 38.9072, lng: -77.0369, timezone: "America/New_York" },
  { id: "us-miami", city: "Miami", country: "United States", countryCode: "US", lat: 25.7617, lng: -80.1918, timezone: "America/New_York" },
  { id: "us-atlanta", city: "Atlanta", country: "United States", countryCode: "US", lat: 33.749, lng: -84.388, timezone: "America/New_York" }
];

export function findLocationById(id) {
  return LOCATIONS.find((l) => l.id === id) || null;
}

export function locationsByCountry() {
  const map = {};
  for (const loc of LOCATIONS) {
    if (!map[loc.country]) map[loc.country] = [];
    map[loc.country].push(loc);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.city.localeCompare(b.city));
  }
  return map;
}

export function countryList() {
  return Object.keys(locationsByCountry()).sort();
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 == null || lng1 == null || lat2 == null || lng2 == null ||
    Number.isNaN(Number(lat1)) || Number.isNaN(Number(lng1)) ||
    Number.isNaN(Number(lat2)) || Number.isNaN(Number(lng2))
  ) {
    return null;
  }
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadiusKm(customer, sitter, radiusKm) {
  const d = haversineKm(customer?.lat, customer?.lng, sitter?.lat, sitter?.lng);
  if (d == null) return false;
  const r = Number(radiusKm);
  if (!r || r <= 0) return false;
  return d <= r + 0.05;
}

export function wallTimeToUtcDate(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.slice(0, 5).split(":").map(Number);
  let utc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utc)).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second || 0)
    );
    const desired = Date.UTC(y, m - 1, d, hh, mm, 0);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function formatInTimezone(date, timeZone, opts = {}) {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || undefined,
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(new Date(date));
}

export function locationLabel(loc) {
  if (!loc) return "";
  return (loc.city || "") + ", " + (loc.country || "");
}
