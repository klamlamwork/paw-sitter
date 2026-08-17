import { createClient } from "@/lib/supabase/client";

// Normalize province/state input to a region code like "CA-ON" or "US-CA"
export function normalizeRegionCode(country, provinceState) {
  if (!country || !provinceState) return null;
  const c = String(country).toUpperCase();
  const p = String(provinceState).toUpperCase();
  if (c === "CA") return `CA-${p}`;
  if (c === "US") return `US-${p}`;
  return `${c}-${p}`;
}

// Check if a region is excluded (supports wildcards like "US-*")
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

// Determine shipping scope: "home" | "national" | "us" | "blocked"
export function resolveShippingScope({
  address,
  shopProvince,
  allowNational,
  nationalRegions,
  shipToUs,
  excludeRegions,
}) {
  const country = String(address.country || "").toUpperCase();
  const region = normalizeRegionCode(country, address.province_state);
  if (!region) return { scope: "blocked", reason: "Missing address" };

  if (isRegionExcluded(region, excludeRegions || [])) {
    return { scope: "blocked", reason: "Region excluded" };
  }

  const homePrefix = shopProvince?.includes("-") ? shopProvince : `CA-${shopProvince}`;
  if (region === homePrefix) {
    return { scope: "home" };
  }

  if (country === "US") {
    if (!shipToUs) return { scope: "blocked", reason: "US not allowed" };
    return { scope: "us" };
  }

  // CA out-of-province
  if (!allowNational) {
    return { scope: "blocked", reason: "National not allowed" };
  }
  if (!nationalRegions || nationalRegions.length === 0) {
    // Empty list means all CA out-of-province allowed
    return { scope: "national" };
  }
  if (nationalRegions.includes(region)) {
    return { scope: "national" };
  }
  return { scope: "blocked", reason: "National region not listed" };
}

// Resolve rate for a method and scope, applying thresholds
export function resolveShippingRate({
  settings,
  method,
  scope,
  subtotalCents,
}) {
  if (!settings || !method || !scope) return null;
  const m = method;
  const s = scope;

  // Thresholds
  const thresholdKey = `${m}_${s}_free_over_cents`;
  const freeOver = settings[thresholdKey];
  if (typeof freeOver === "number" && subtotalCents >= freeOver) {
    return { cents: 0, minDays: null, maxDays: null, label: makeLabel(method, scope, settings, true) };
  }

  // Base flat
  const flatKey = `${m}_${s}_flat_cents`;
  let cents = settings[flatKey] || 0;

  // Express surcharge mode
  if (method === "express" && settings.express_rate_mode === "surcharge") {
    const homeBase = settings[`${m}_home_flat_cents`] || 0;
    cents = homeBase + (settings.express_surcharge_cents || 0);
  }

  const minKey = `${m}_${s}_min_days`;
  const maxKey = `${m}_${s}_max_days`;
  const minDays = settings[minKey] ?? null;
  const maxDays = settings[maxKey] ?? null;

  return { cents, minDays, maxDays, label: makeLabel(method, scope, settings, false) };
}

function makeLabel(method, scope, settings, free) {
  if (free) return `${capitalize(method)} · Free`;
  const min = settings[`${method}_${scope}_min_days`];
  const max = settings[`${method}_${scope}_max_days`];
  const days = min != null && max != null ? ` · ${min}–${max} business days` : "";
  return `${capitalize(method)}${days}`;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Fetch shop settings for a given shopId
export async function fetchShopShippingSettings(shopId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shop_shipping_settings")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Fetch overrides for a list of product/variant IDs under a shop
export async function fetchShippingOffers({ shopId, productIds = [], variantIds = [] }) {
  const supabase = createClient();
  const q = supabase.from("shop_shipping_offers").select("*").eq("shop_id", shopId);
  const conditions = [];
  if (productIds.length) conditions.push(q.or(productIds.map((id) => `product_id.eq.${id}`)).join(","));
  if (variantIds.length) conditions.push(q.or(variantIds.map((id) => `variant_id.eq.${id}`)).join(","));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
