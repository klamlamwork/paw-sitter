export const SHOP_PRODUCT_STATUSES = ["draft", "pending", "approved", "rejected", "archived"];

export const SHOP_SPECIES = ["dog", "cat", "both"];

export const SHOP_LIFE_STAGES = ["puppy_kitten", "adult", "senior"];

export function slugifyShop(text) {
  return (
    String(text || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "item"
  );
}

export function formatShopPrice(cents, currency = "CAD", hidePrice = false) {
  if (hidePrice || cents == null || cents === "") return null;
  const n = Number(cents) / 100;
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)} ${currency}`;
  }
}

export function productPath(slug) {
  return `/shop/p/${slug}`;
}

export function categoryPath(slug) {
  return `/shop/c/${slug}`;
}

export function brandPath(slug) {
  return `/shop/brands/${slug}`;
}

/** Vendor/brand storefront — not /vendors */
export function shopStorePath(slug) {
  return `/shop/shops/${slug}`;
}

export function isApprovedProduct(p) {
  return p && p.status === "approved";
}
