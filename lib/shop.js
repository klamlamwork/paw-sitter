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

/** Public brand hub URL for a product-brand shop */
export function brandShopPath(shop) {
  if (!shop?.slug) return "/shop/brands";
  return `/shop/brands/${shop.slug}`;
}

/** @deprecated use brandShopPath */
export function brandPath(brandOrShop) {
  return brandShopPath(brandOrShop);
}

/** Public storefront URL for any shop */
export function shopPath(shop) {
  if (!shop?.slug) return "/shop/shops";
  return `/shop/shops/${shop.slug}`;
}

/** @deprecated use shopPath */
export function shopStorePath(shop) {
  return shopPath(shop);
}

/** Canonical product URL (brand hub view) */
export function productPath(product) {
  if (!product?.slug) return "/shop";
  return `/shop/p/${product.slug}`;
}

/** Retailer-specific product/offer URL */
export function shopProductPath(shop, product) {
  if (!shop?.slug || !product?.slug) return productPath(product);
  return `/shop/shops/${shop.slug}/p/${product.slug}`;
}

export function isProductBrandShop(shop) {
  return !!(shop && (shop.is_product_brand || shop.shop_type === "brand"));
}

/** Shop owner portal base */
export function shopPortalPath() {
  return "/account/shop";
}
