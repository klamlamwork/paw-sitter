/** Shop catalog helpers — unified shops (product brand = shop flag). */

export function slugifyShop(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatShopPrice(cents, currency = "CAD", hide = false) {
  if (hide) return null;
  if (cents == null || !Number.isFinite(Number(cents))) return null;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
    }).format(Number(cents) / 100);
  } catch {
    return `$${(Number(cents) / 100).toFixed(2)} ${currency || "CAD"}`;
  }
}

export function brandShopPath(shop) {
  if (!shop?.slug) return "/shop/brands";
  return `/shop/brands/${shop.slug}`;
}

export function brandPath(brandOrShop) {
  return brandShopPath(brandOrShop);
}

export function shopPath(shop) {
  if (!shop?.slug) return "/shop/shops";
  return `/shop/shops/${shop.slug}`;
}

export function shopStorePath(shop) {
  return shopPath(shop);
}

export function productPath(product) {
  if (!product?.slug) return "/shop";
  return `/shop/p/${product.slug}`;
}

/** Retailer storefront — there is no /shop/shops/[slug]/p/[product] route. */
export function shopProductPath(shop, product) {
  if (shop?.slug) return shopPath(shop);
  return productPath(product);
}

/**
 * Eligible-retailer logo target.
 * Use a full https:// URL to the retailer’s own product page.
 * Blank / invalid values open the retailer’s Paw Sitter storefront.
 */
export function retailerOfferHref(shop, productPageUrl) {
  const raw = String(productPageUrl || "").trim();
  if (!raw) return shopPath(shop);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/shop/shops/") && /\/p\//.test(raw)) return shopPath(shop);
  if (raw.startsWith("/")) return raw;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(raw)) return `https://${raw}`;
  return shopPath(shop);
}

export function isExternalHttpUrl(href) {
  return /^https?:\/\//i.test(String(href || ""));
}

export function normalizeRetailerProductUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
  return value;
}

export function isProductBrandShop(shop) {
  return !!(shop && (shop.is_product_brand || shop.shop_type === "brand"));
}

export function shopPortalPath() {
  return "/account/shop";
}

export const LONGEVITY_ICONS = [
  { key: "heart", emoji: "❤️", label: "Heart" },
  { key: "leaf", emoji: "🌿", label: "Natural" },
  { key: "bone", emoji: "🦴", label: "Joints" },
  { key: "brain", emoji: "🧠", label: "Cognition" },
  { key: "shield", emoji: "🛡️", label: "Immune" },
  { key: "drop", emoji: "💧", label: "Hydration" },
  { key: "sun", emoji: "☀️", label: "Vitality" },
  { key: "paw", emoji: "🐾", label: "Mobility" },
  { key: "fish", emoji: "🐟", label: "Omega" },
  { key: "sparkle", emoji: "✨", label: "Glow" },
  { key: "clock", emoji: "⏳", label: "Aging" },
  { key: "star", emoji: "⭐", label: "Quality" },
];

export function longevityIconEmoji(iconKey) {
  const found = LONGEVITY_ICONS.find((i) => i.key === iconKey);
  return found?.emoji || "✨";
}
