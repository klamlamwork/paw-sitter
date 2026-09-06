import { PRODUCT_TYPES, normalizeProductType } from "@/lib/shopInventory";

/**
 * Shared taxonomy for /shop filters, product create/edit, and later KOL.
 * Blog tags (admin/blog/tags) are not part of this system.
 *
 * Line 1: Brand names (shop_shops where is_product_brand)
 * Line 2: Product type (shop_products.product_type)
 * Line 3: Product categories top level (shop_categories.filter_row 1)
 * Line 4: Product categories secondary / sub (shop_categories.filter_row 2)
 */

export const SHARED_TAXONOMY_SOURCE = {
  brand: "shop_shops.is_product_brand",
  productType: "shop_products.product_type",
  categories: "shop_categories.filter_row + shop_product_categories",
  blogTags: "excluded",
};

export function brandFilterItems(brands = []) {
  return (brands || [])
    .filter((b) => b && b.id && b.name && b.is_product_brand !== false)
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug || "",
    }));
}

export function productTypeFilterItems() {
  return (PRODUCT_TYPES || []).map((t) => ({
    id: t.value,
    name: t.label,
    value: t.value,
  }));
}

export function splitCategoryFilterRows(categories = []) {
  const list = categories || [];
  const topLevel = list
    .filter((c) => c && (c.filter_row == null || Number(c.filter_row) === 1))
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")));
  const secondary = list
    .filter((c) => c && Number(c.filter_row) === 2)
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || "")));
  return { topLevel, secondary };
}

function hasAll(selected, actual) {
  if (!selected || selected.size === 0) return true;
  for (const id of selected) {
    if (!actual.has(id)) return false;
  }
  return true;
}

/** AND across lists: product must match every selected brand, type, and category. */
export function productMatchesSharedFilters(product, { brandIds, productTypes, categoryIds } = {}) {
  if (!product) return false;
  const brands = new Set(brandIds || []);
  const types = new Set(productTypes || []);
  const cats = new Set(categoryIds || []);
  const productBrand = product.brand_shop_id || null;
  const productType = normalizeProductType(product.product_type);
  const productCats = new Set(product.category_ids || (product.category_id ? [product.category_id] : []));
  if (brands.size && !brands.has(productBrand)) return false;
  if (types.size && !types.has(productType)) return false;
  if (!hasAll(cats, productCats)) return false;
  return true;
}
