import { createAdminClient } from "@/lib/supabase/admin";

const CONTENT_TYPES = new Set(["review", "how_to", "education"]);

export function normalizeCommunityContentType(value) {
  return CONTENT_TYPES.has(value) ? value : "review";
}

async function ownsAnyShop(admin, profileId, shopIds) {
  const ids = [...new Set((shopIds || []).filter(Boolean))];
  if (!ids.length) return false;
  const { data } = await admin.from("shop_shops").select("id").eq("owner_profile_id", profileId).in("id", ids).limit(1);
  return (data || []).length > 0;
}

export async function findApprovedProduct(productId) {
  if (!productId) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("shop_products").select("id, name, slug, status, primary_shop_id, brand_shop_id").eq("id", productId).eq("status", "approved").maybeSingle();
  return data || null;
}

export async function searchApprovedProducts(query, { slug = "" } = {}) {
  const admin = createAdminClient();
  if (slug) {
    const { data } = await admin.from("shop_products").select("id, name, slug").eq("status", "approved").eq("slug", slug).maybeSingle();
    return data ? [data] : [];
  }
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const { data } = await admin.from("shop_products").select("id, name, slug").eq("status", "approved").ilike("name", `%${q}%`).order("name").limit(20);
  return data || [];
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

export async function ownedCommunityDraft(admin, profileId) {
  const { data: post } = await admin
    .from("shop_kol_posts")
    .select("id, status, primary_product_id, content_type, created_at")
    .eq("author_profile_id", profileId)
    .eq("source_type", "community")
    .in("status", ["draft", "needs_changes"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!post) return null;
  const { count } = await admin.from("shop_kol_post_media").select("id", { count: "exact", head: true }).eq("post_id", post.id).in("lifecycle", ["unattached", "attached_private"]);
  const product = post.primary_product_id ? await findApprovedProduct(post.primary_product_id) : null;
  return { ...post, media_count: count || 0, product: product ? { id: product.id, name: product.name, slug: product.slug } : null };
}
