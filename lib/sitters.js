export const SERVICE_LABELS = {
  house_sit: "House sit",
  drop_in: "Drop-in",
  walking: "Dog walking",
  boarding: "Boarding",
};

export const SERVICE_RATE_UNITS = {
  house_sit: "night",
  drop_in: "30 min",
  walking: "walk",
  boarding: "night",
};

export function serviceLabel(type) {
  return SERVICE_LABELS[type] || String(type || "").replace(/_/g, " ");
}

export function serviceRateUnit(type) {
  return SERVICE_RATE_UNITS[type] || "visit";
}

export function enabledServices(sitter) {
  const rows = sitter?.sitter_services || sitter?.services || [];
  return (rows || []).filter((s) => s && s.enabled !== false);
}

export function formatCityCountry(sitter) {
  const city = (sitter?.service_city || "").trim();
  const country = (sitter?.service_country || "").trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || "Service area TBA";
}
