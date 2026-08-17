export function isUnlimitedRadius(radiusKm) {
  if (radiusKm == null || radiusKm === "") return true;
  const n = Number(radiusKm);
  return !Number.isFinite(n) || n <= 0;
}

export function isAnywhereLabel(value) {
  const s = String(value || "")
    .trim()
    .toLowerCase();
  return ["anywhere", "worldwide", "global", "earth", "any", "all"].includes(s);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

export function sitterCoversAddress(sitter, svc, address) {
  if (!svc) return false;
  if (isUnlimitedRadius(svc.radius_km)) return true;
  if (
    isAnywhereLabel(sitter?.service_city) ||
    isAnywhereLabel(sitter?.city) ||
    isAnywhereLabel(svc.area_label)
  ) {
    return true;
  }

  const sCity = norm(sitter?.service_city || sitter?.city);
  const cCity = norm(address?.city);
  if (sCity && cCity && sCity === cCity) return true;

  if (address?.lat != null && address?.lng != null && sitter?.lat != null && sitter?.lng != null) {
    return haversineKm(address.lat, address.lng, sitter.lat, sitter.lng) <= Number(svc.radius_km) + 0.05;
  }

  return false;
}
