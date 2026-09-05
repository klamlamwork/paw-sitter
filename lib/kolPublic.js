import { createAdminClient } from "@/lib/supabase/admin";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

function videoUrl(publicId, version) {
  const cloud = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud || !publicId) return "";
  return `https://res.cloudinary.com/${cloud}/video/upload/f_auto,q_auto${version ? `/v${version}` : ""}/${publicId}`;
}

export function slugifyKolTitle(value) {
  return String(value || "review").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "review";
}

export async function uniqueKolSlug(admin, title, postId) {
  const base = slugifyKolTitle(title);
  const suffix = String(postId || "").replace(/-/g, "").slice(0, 8) || "post";
  let slug = `${base}-${suffix}`;
  const { data } = await admin.from("shop_kol_posts").select("id").eq("slug", slug).maybeSingle();
  if (data && data.id !== postId) slug = `${base}-${String(postId).replace(/-/g, "").slice(0, 12)}`;
  return slug;
}

function mediaUrl(row) {
  return row.resource_type === "video" ? videoUrl(row.public_id, row.version) : cloudinaryImageUrl({ publicId: row.public_id, version: row.version, width: 900, height: 900 });
}

async function hydratePublishedPosts(admin, list, productById = {}) {
  if (!list.length) return [];
  const authorIds = [...new Set(list.map((post) => post.author_profile_id).filter(Boolean))];
  const revisionIds = [...new Set(list.map((post) => post.published_revision_id).filter(Boolean))];
  const productIds = [...new Set(list.map((post) => post.primary_product_id).filter(Boolean))];
  const [authorsResult, revisionsResult, mediaResult, productsResult] = await Promise.all([
    authorIds.length ? admin.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] },
    revisionIds.length ? admin.from("shop_kol_post_revisions").select("id, title, body, rating").in("id", revisionIds) : { data: [] },
    admin.from("shop_kol_post_media").select("id, post_id, public_id, version, resource_type, sort_order").in("post_id", list.map((post) => post.id)).eq("lifecycle", "published").order("sort_order"),
    productIds.length && !Object.keys(productById).length ? admin.from("shop_products").select("id, name, slug").in("id", productIds) : { data: [] },
  ]);
  const authors = Object.fromEntries((authorsResult.data || []).map((row) => [row.id, row]));
  const revisions = Object.fromEntries((revisionsResult.data || []).map((row) => [row.id, row]));
  const products = Object.keys(productById).length ? productById : Object.fromEntries((productsResult.data || []).map((row) => [row.id, row]));
  const mediaByPost = {};
  for (const row of mediaResult.data || []) (mediaByPost[row.post_id] ||= []).push({ id: row.id, resource_type: row.resource_type, url: mediaUrl(row) });
  return list.map((post) => {
    const revision = revisions[post.published_revision_id] || {};
    const product = products[post.primary_product_id] || null;
    return {
      id: post.id,
      href: `/shop/reviews/${post.slug || post.id}`,
      slug: post.slug || post.id,
      title: revision.title || "",
      body: revision.body || "",
      rating: revision.rating || null,
      verified_badge: !!post.verified_badge,
      published_at: post.published_at,
      author_name: authors[post.author_profile_id]?.full_name || "Member",
      media: mediaByPost[post.id] || [],
      product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
    };
  }).filter((post) => post.media.length);
}

export async function publishedKolForSlug(slug) {
  if (!slug) return [];
  const admin = createAdminClient();
  const { data: product } = await admin.from("shop_products").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (!product) return [];
  const [{ data: primaryPosts }, { data: linked }] = await Promise.all([
    admin.from("shop_kol_posts").select("id").eq("status", "published").eq("primary_product_id", product.id),
    admin.from("shop_kol_post_products").select("post_id").eq("product_id", product.id),
  ]);
  const ids = [...new Set([...(primaryPosts || []).map((row) => row.id), ...(linked || []).map((row) => row.post_id)].filter(Boolean))];
  if (!ids.length) return [];
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, verified_badge, published_revision_id, published_at, primary_product_id").eq("status", "published").in("id", ids).order("published_at", { ascending: false });
  return hydratePublishedPosts(admin, posts || [], { [product.id]: product });
}

export async function publishedKolAll(limit = 50) {
  const admin = createAdminClient();
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, verified_badge, published_revision_id, published_at, primary_product_id").eq("status", "published").order("published_at", { ascending: false }).limit(limit);
  return hydratePublishedPosts(admin, posts || []);
}

export async function publishedKolByPermalink(slug) {
  if (!slug) return null;
  const admin = createAdminClient();
  let { data: post } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, verified_badge, published_revision_id, published_at, primary_product_id").eq("status", "published").eq("slug", slug).maybeSingle();
  if (!post) {
    const byId = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, verified_badge, published_revision_id, published_at, primary_product_id").eq("status", "published").eq("id", slug).maybeSingle();
    post = byId.data;
  }
  if (!post) return null;
  const [hydrated] = await hydratePublishedPosts(admin, [post]);
  return hydrated || null;
}
