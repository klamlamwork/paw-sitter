export function normalizeRegionCode(country, provinceState) {
  if (!provinceState) return null;
  const raw = String(provinceState).trim().toUpperCase();
  if (raw.includes("-")) return raw;
  const c = String(country || "CA").trim().toUpperCase();
  const countryCode = c === "CANADA" ? "CA" : c === "UNITED STATES" || c === "USA" ? "US" : c;
  return `${countryCode}-${raw}`;
}

export function isRegionExcluded(regionCode, excludeRegions) {
  if (!regionCode || !Array.isArray(excludeRegions)) return false;
  for (const ex of excludeRegions) {
    if (typeof ex !== "string") continue;
    if (ex.includes("*")) {
      const prefix = ex.replace("*", "");
      if (regionCode.startsWith(prefix)) return true;
    } else if (ex === regionCode) {
      return true;
    }
  }
  return false;
}

export function buyerAddressFields(address = {}) {
  return {
    country: address.country || "Canada",
    provinceState: address.province_state || address.state || address.province || "",
  };
}

export function resolveShippingScope({
  address,
  shopProvince,
  allowNational,
  nationalRegions,
  shipToUs,
  excludeRegions,
}) {
  const { country, provinceState } = buyerAddressFields(address);
  const region = normalizeRegionCode(country, provinceState);
  if (!region) return { scope: "blocked", reason: "Add a province/state to calculate shipping." };

  if (isRegionExcluded(region, excludeRegions || [])) {
    return { scope: "blocked", reason: "This shop does not ship to your region." };
  }

  const countryCode = region.split("-")[0];
  const home = shopProvince
    ? shopProvince.includes("-")
      ? shopProvince.toUpperCase()
      : `CA-${String(shopProvince).toUpperCase()}`
    : null;

  if (home && region === home) return { scope: "home", region };

  if (countryCode === "US") {
    if (!shipToUs) return { scope: "blocked", reason: "This shop does not ship to the United States." };
    return { scope: "us", region };
  }

  if (!allowNational) return { scope: "blocked", reason: "This shop only ships within its home province." };
  if (Array.isArray(nationalRegions) && nationalRegions.length && !nationalRegions.includes(region)) {
    return { scope: "blocked", reason: "This shop does not ship to your province." };
  }
  return { scope: "national", region };
}

export function resolveShippingRate({ settings, method, scope, subtotalCents }) {
  const m = method === "express" || method === "pickup" ? method : "standard";
  if (m === "express" && settings && settings.express_enabled === false) {
    return null;
  }
  if (m === "pickup" && settings && settings.pickup_enabled === false) {
    return null;
  }

  const s = scope === "us" || scope === "national" ? scope : "home";
  const src = settings || {};
  const freeOver = src[`${m}_${s}_free_over_cents`];
  if (typeof freeOver === "number" && subtotalCents >= freeOver) {
    return { cents: 0, minDays: src[`${m}_${s}_min_days`] ?? null, maxDays: src[`${m}_${s}_max_days`] ?? null, label: labelFor(m, s, src, true) };
  }

  let cents = Number(src[`${m}_${s}_flat_cents`]) || 0;
  if (m === "express" && src.express_rate_mode === "surcharge") {
    cents = (Number(src.express_home_flat_cents) || 0) + (Number(src.express_surcharge_cents) || 0);
  }

  return {
    cents,
    minDays: src[`${m}_${s}_min_days`] ?? null,
    maxDays: src[`${m}_${s}_max_days`] ?? null,
    label: labelFor(m, s, src, false),
  };
}

function labelFor(method, scope, settings, free) {
  const name = method === "pickup" ? "Pickup" : method === "express" ? "Express" : "Standard";
  if (free) return `${name} · Free`;
  const min = settings[`${method}_${scope}_min_days`];
  const max = settings[`${method}_${scope}_max_days`];
  const days = min != null && max != null ? ` · ${min}–${max} business days` : "";
  return `${name}${days}`;
}

export function defaultShippingSettings() {
  return {
    fulfillment_province: "CA-ON",
    allow_national: true,
    national_regions: [],
    ship_to_us: false,
    exclude_regions: [],
    standard_home_flat_cents: 800,
    standard_home_min_days: 3,
    standard_home_max_days: 7,
    standard_national_flat_cents: 1200,
    standard_national_min_days: 5,
    standard_national_max_days: 10,
    standard_us_flat_cents: 2500,
    standard_us_min_days: 7,
    standard_us_max_days: 14,
    express_enabled: true,
    express_rate_mode: "flat",
    express_surcharge_cents: 0,
    express_home_flat_cents: 1500,
    express_home_min_days: 1,
    express_home_max_days: 3,
    express_national_flat_cents: 2200,
    express_national_min_days: 2,
    express_national_max_days: 4,
    express_us_flat_cents: 3500,
    express_us_min_days: 3,
    express_us_max_days: 6,
    pickup_enabled: true,
    pickup_ready_hours: 24,
    pickup_home_flat_cents: 0,
    pickup_national_flat_cents: 0,
    pickup_us_flat_cents: 0,
  };
}
