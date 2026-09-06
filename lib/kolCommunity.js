import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeProductType } from "@/lib/shopInventory";

const CONTENT_TYPES = new Set(["review", "how_to"]);

export function normalizeCommunityContentType(value) {
  return CONTENT_TYPES.has(value) ? value : "review";
}

async function ownsAnyShop(admin, profileId, shopIds) {
  const ids = [...new Set((shopIds || []).filter(Boolean))];
  if (!ids.length) return false;
  const { data } = await admin.from("shop_shops").select("id").eq("owner_profile_id", profileId).in("id", ids).limit(1);
  return (data || []).length > 0;
}

export async function listProductBrands() {
  const admin = createAdminClient();
  const { data } = await admin.from("shop_shops").select("id, name").eq("is_product_brand", true).order("name");
  return data || [];
}

export async function findApprovedProduct(productId) {
  if (!productId) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("shop_products").select("id, name, slug, status, primary_shop_id, brand_shop_id, product_type, category_id").eq("id", productId).eq("status", "approved").maybeSingle();
  return data || null;
}

export async function searchApprovedProducts(query, { slug = "", brandId = "" } = {}) {
  const admin = createAdminClient();
  if (slug) {
    let req = admin.from("shop_products").select("id, name, slug, brand_shop_id, product_type").eq("status", "approved").eq("slug", slug);
    if (brandId) req = req.eq("brand_shop_id", brandId);
    const { data } = await req.maybeSingle();
    return data ? [data] : [];
  }
  if (!brandId) return [];
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const { data } = await admin.from("shop_products").select("id, name, slug, brand_shop_id, product_type").eq("status", "approved").eq("brand_shop_id", brandId).ilike("name", `%${q}%`).order("name").limit(20);
  return data || [];
}

export async function productTaxonomyFromShop(admin, productId) {
  const { data: product } = await admin.from("shop_products").select("id, product_type, brand_shop_id, category_id").eq("id", productId).maybeSingle();
  const { data: links } = await admin.from("shop_product_categories").select("category_id").eq("product_id", productId);
  const ids = [...new Set((links || []).map((row) => row.category_id).filter(Boolean))];
  if (!ids.length && product?.category_id) ids.push(product.category_id);
  const row1 = [];
  const row2 = [];
  if (ids.length) {
    const { data: cats } = await admin.from("shop_categories").select("id, filter_row").in("id", ids);
    for (const cat of cats || []) {
      if (Number(cat.filter_row) === 2) row2.push(cat.id);
      else row1.push(cat.id);
    }
  }
  const { data: lon } = await admin.from("shop_product_longevity_items").select("label").eq("product_id", productId);
  return {
    brand_shop_id: product?.brand_shop_id || null,
    product_type: normalizeProductType(product?.product_type),
    category_ids: ids,
    category_row1_ids: row1,
    category_row2_ids: row2,
    longevity_labels: [...new Set((lon || []).map((row) => String(row.label || "").trim()).filter(Boolean))],
  };
}

export async function linkCommunityProducts(admin, postId, products, extrasById = {}) {
  await admin.from("shop_kol_post_products").delete().eq("post_id", postId);
  const rows = products.map((product, index) => {
    const extra = extrasById[product.id] || {};
    return {
      post_id: postId,
      product_id: product.id,
      is_primary: index === 0,
      description: String(extra.description || "").trim(),
    };
  });
  const { error } = await admin.from("shop_kol_post_products").insert(rows);
  if (error) throw error;
}

export async function assertCommunityProductAccess(profileId, productId) {
  const product = await findApprovedProduct(productId);
  if (!product) throw new Error("Choose a product from the shop catalog.");
  const admin = createAdminClient();
  if (await ownsAnyShop(admin, profileId, [product.primary_shop_id, product.brand_shop_id])) {
    throw new Error("Shop and brand owners cannot submit community posts for their own products.");
  }
  return product;
}

export async function assertCommunityProducts(profileId, productIds, brandId) {
  const ids = [...new Set((productIds || []).filter(Boolean))].slice(0, 10);
  if (!ids.length) throw new Error("Choose 1 to 10 catalog products.");
  const products = [];
  for (const id of ids) {
    const product = await assertCommunityProductAccess(profileId, id);
    if (brandId && product.brand_shop_id !== brandId) throw new Error("Choose products from the selected brand only.");
    products.push(product);
  }
  return products;
}

export async function ownedCommunityDraft(admin, profileId) {
  const { data: post } = await admin.from("shop_kol_posts").select("id, status, primary_product_id, content_type, created_at").eq("author_profile_id", profileId).eq("source_type", "community").in("status", ["draft", "needs_changes"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post) return null;
  const [{ count }, { data: productRows }, { data: media }] = await Promise.all([
    admin.from("shop_kol_post_media").select("id", { count: "exact", head: true }).eq("post_id", post.id).in("lifecycle", ["unattached", "attached_private"]),
    admin.from("shop_kol_post_products").select("product_id, is_primary, description").eq("post_id", post.id),
    admin.from("shop_kol_post_media").select("id, public_id, version, resource_type, caption, is_cover, product_id, sort_order").eq("post_id", post.id).in("lifecycle", ["unattached", "attached_private"]).order("sort_order"),
  ]);
  const products = [];
  for (const row of productRows || []) {
    const product = await findApprovedProduct(row.product_id);
    if (!product) continue;
    const tax = await productTaxonomyFromShop(admin, product.id);
    products.push({ id: product.id, name: product.name, slug: product.slug, description: row.description || "", is_primary: !!row.is_primary, ...tax });
  }
  return { ...post, media_count: count || 0, products, media: media || [] };
}
