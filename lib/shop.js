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

export function shopProductPath(shop, product) {
  if (!shop?.slug || !product?.slug) return productPath(product);
  return `/shop/shops/${shop.slug}/p/${product.slug}`;
}

export function isProductBrandShop(shop) {
  return !!(shop && (shop.is_product_brand || shop.shop_type === "brand"));
}

export function shopPortalPath() {
  return "/account/shop";
}

/** Preset circle icons for longevity chips (emoji inside circle on UI). */
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
