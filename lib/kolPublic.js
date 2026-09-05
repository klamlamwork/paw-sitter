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

function mapMedia(row) {
  return { id: row.id, resource_type: row.resource_type, url: mediaUrl(row), caption: row.caption || "", is_cover: !!row.is_cover, product_id: row.product_id || null, sort_order: Number(row.sort_order || 0) };
}

export function shapeKolPost({ post, revision, author, products, media }) {
  const files = (media || []).map(mapMedia).sort((a, b) => a.sort_order - b.sort_order);
  const cover = files.find((row) => row.is_cover) || files.find((row) => !row.product_id) || files[0] || null;
  const slides = files.filter((row) => !row.product_id && (!cover || row.id !== cover.id));
  const takeaways = Array.isArray(revision?.key_takeaways) ? revision.key_takeaways.map((row) => String(row || "").trim()).filter(Boolean) : [];
  return {
    id: post.id,
    href: `/shop/reviews/${post.slug || post.id}`,
    slug: post.slug || post.id,
    title: revision?.title || "",
    body: revision?.body || "",
    rating: revision?.rating || null,
    key_takeaways: takeaways,
    verified_badge: !!post.verified_badge,
    source_type: post.source_type,
    content_type: post.content_type || "review",
    published_at: post.published_at || revision?.submitted_at || post.created_at,
    author_id: post.author_profile_id,
    author_name: author?.full_name || "Member",
    author_href: post.author_profile_id ? `/shop/reviews/author/${post.author_profile_id}` : "",
    cover,
    slides,
    media: files,
    products: (products || []).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      media: files.filter((row) => row.product_id === product.id),
    })),
  };
}

async function hydratePublishedPosts(admin, list) {
  if (!list.length) return [];
  const authorIds = [...new Set(list.map((post) => post.author_profile_id).filter(Boolean))];
  const revisionIds = [...new Set(list.map((post) => post.published_revision_id || post.pending_revision_id).filter(Boolean))];
  const postIds = list.map((post) => post.id);
  const [authorsResult, revisionsResult, mediaResult, productRows] = await Promise.all([
    authorIds.length ? admin.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] },
    revisionIds.length ? admin.from("shop_kol_post_revisions").select("id, title, body, rating, key_takeaways, submitted_at").in("id", revisionIds) : { data: [] },
    postIds.length ? admin.from("shop_kol_post_media").select("id, post_id, public_id, version, resource_type, caption, is_cover, product_id, sort_order, lifecycle").in("post_id", postIds).in("lifecycle", ["published", "attached_private"]).order("sort_order") : { data: [] },
    postIds.length ? admin.from("shop_kol_post_products").select("post_id, product_id, is_primary, description").in("post_id", postIds) : { data: [] },
  ]);
  const productIds = [...new Set((productRows.data || []).map((row) => row.product_id).concat(list.map((post) => post.primary_product_id)).filter(Boolean))];
  const { data: productCatalog } = productIds.length ? await admin.from("shop_products").select("id, name, slug").in("id", productIds) : { data: [] };
  const authors = Object.fromEntries((authorsResult.data || []).map((row) => [row.id, row]));
  const revisions = Object.fromEntries((revisionsResult.data || []).map((row) => [row.id, row]));
  const catalog = Object.fromEntries((productCatalog || []).map((row) => [row.id, row]));
  const mediaByPost = {};
  for (const row of mediaResult.data || []) (mediaByPost[row.post_id] ||= []).push(row);
  const productsByPost = {};
  for (const row of productRows.data || []) {
    const product = catalog[row.product_id];
    if (!product) continue;
    (productsByPost[row.post_id] ||= []).push({ ...product, description: row.description || "", is_primary: !!row.is_primary });
  }
  return list.map((post) => shapeKolPost({
    post,
    revision: revisions[post.published_revision_id || post.pending_revision_id] || {},
    author: authors[post.author_profile_id],
    products: productsByPost[post.id] || (catalog[post.primary_product_id] ? [catalog[post.primary_product_id]] : []),
    media: mediaByPost[post.id] || [],
  }));
}

export async function publishedKolForSlug(slug) {
  if (!slug) return [];
  const admin = createAdminClient();
  const { data: product } = await admin.from("shop_products").select("id").eq("slug", slug).maybeSingle();
  if (!product) return [];
  const [{ data: primaryPosts }, { data: linked }] = await Promise.all([
    admin.from("shop_kol_posts").select("id").eq("status", "published").eq("primary_product_id", product.id),
    admin.from("shop_kol_post_products").select("post_id").eq("product_id", product.id),
  ]);
  const ids = [...new Set([...(primaryPosts || []).map((row) => row.id), ...(linked || []).map((row) => row.post_id)].filter(Boolean))];
  if (!ids.length) return [];
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id").eq("status", "published").in("id", ids).order("published_at", { ascending: false });
  return hydratePublishedPosts(admin, posts || []);
}

export async function publishedKolAll(limit = 50) {
  const admin = createAdminClient();
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id").eq("status", "published").order("published_at", { ascending: false }).limit(limit);
  return hydratePublishedPosts(admin, posts || []);
}

export async function publishedKolByPermalink(slug) {
  if (!slug) return null;
  const admin = createAdminClient();
  let { data: post } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id").eq("status", "published").eq("slug", slug).maybeSingle();
  if (!post) {
    const byId = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id").eq("status", "published").eq("id", slug).maybeSingle();
    post = byId.data;
  }
  if (!post) return null;
  const [hydrated] = await hydratePublishedPosts(admin, [post]);
  return hydrated || null;
}

export async function publishedKolByAuthor(authorId, limit = 50) {
  if (!authorId) return [];
  const admin = createAdminClient();
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id").eq("status", "published").eq("author_profile_id", authorId).order("published_at", { ascending: false }).limit(limit);
  return hydratePublishedPosts(admin, posts || []);
}

export async function pendingKolForAdmin() {
  const admin = createAdminClient();
  const { data: posts } = await admin.from("shop_kol_posts").select("id, slug, author_profile_id, source_type, content_type, verified_badge, published_revision_id, pending_revision_id, published_at, created_at, primary_product_id, status").eq("status", "pending_admin").order("created_at", { ascending: true });
  return hydratePublishedPosts(admin, posts || []);
}
