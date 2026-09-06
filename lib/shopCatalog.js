import { cloudinaryImageUrl } from "@/lib/cloudinary";
import { normalizeProductType } from "@/lib/shopInventory";

export function sortCategoriesForFilters(categories) {
  const cats = categories || [];
  const row1 = cats
    .filter((c) => c.filter_row == null || c.filter_row === 1)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  const row2 = cats
    .filter((c) => c.filter_row === 2)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
  return { categoriesRow1: row1, categoriesRow2: row2 };
}

function coverUrl(media) {
  if (!media?.public_id) return "";
  return cloudinaryImageUrl({
    publicId: media.public_id,
    version: media.version,
    width: 720,
    height: 720,
  });
}

export async function enrichProducts(supabase, products) {
  const list = products || [];
  const productIds = list.map((p) => p.id);
  const coverByProduct = {};
  const longevityByProduct = {};
  const categoriesByProduct = {};
  const typeById = {};
  const longevitySet = new Set();

  if (!productIds.length) {
    return { products: [], coverByProduct: {}, longevityLabels: [] };
  }

  const safe = async (promise) => {
    try {
      return await promise;
    } catch {
      return { data: null, error: true };
    }
  };

  const [mediaRes, lonRes, catRes, typeRes] = await Promise.all([
    safe(
      supabase
        .from("shop_product_media")
        .select("product_id, public_id, version, sort_order")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true })
    ),
    safe(supabase.from("shop_product_longevity_items").select("product_id, label").in("product_id", productIds)),
    safe(supabase.from("shop_product_categories").select("product_id, category_id").in("product_id", productIds)),
    safe(supabase.from("shop_products").select("id, product_type").in("id", productIds)),
  ]);

  for (const m of mediaRes.data || []) {
    if (coverByProduct[m.product_id]) continue;
    const url = coverUrl(m);
    if (url) coverByProduct[m.product_id] = url;
  }
  for (const it of lonRes.data || []) {
    if (!it.label) continue;
    if (!longevityByProduct[it.product_id]) longevityByProduct[it.product_id] = [];
    longevityByProduct[it.product_id].push(it.label);
    longevitySet.add(it.label);
  }
  for (const link of catRes.data || []) {
    if (!categoriesByProduct[link.product_id]) categoriesByProduct[link.product_id] = [];
    categoriesByProduct[link.product_id].push(link.category_id);
  }
  for (const row of typeRes.data || []) typeById[row.id] = row.product_type;

  const enriched = list.map((p) => {
    const ids = [...(categoriesByProduct[p.id] || [])];
    if (!ids.length && p.category_id) ids.push(p.category_id);
    return {
      ...p,
      product_type: normalizeProductType(p.product_type || typeById[p.id]),
      category_ids: ids,
      longevity_labels: longevityByProduct[p.id] || [],
    };
  });

  return {
    products: enriched,
    coverByProduct,
    longevityLabels: [...longevitySet].sort((a, b) => a.localeCompare(b)),
  };
}
