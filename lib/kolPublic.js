import { createAdminClient } from "@/lib/supabase/admin";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

function videoUrl(publicId, version) {
  const cloud = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud || !publicId) return "";
  return `https://res.cloudinary.com/${cloud}/video/upload/f_auto,q_auto${version ? `/v${version}` : ""}/${publicId}`;
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

  const { data: posts } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, source_type, verified_badge, published_revision_id, published_at")
    .eq("status", "published")
    .in("id", ids)
    .order("published_at", { ascending: false });
  const list = posts || [];
  if (!list.length) return [];

  const authorIds = [...new Set(list.map((post) => post.author_profile_id).filter(Boolean))];
  const revisionIds = [...new Set(list.map((post) => post.published_revision_id).filter(Boolean))];
  const [authorsResult, revisionsResult, mediaResult] = await Promise.all([
    authorIds.length ? admin.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] },
    revisionIds.length ? admin.from("shop_kol_post_revisions").select("id, title, body, rating").in("id", revisionIds) : { data: [] },
    admin.from("shop_kol_post_media").select("id, post_id, public_id, version, resource_type, sort_order").in("post_id", list.map((post) => post.id)).eq("lifecycle", "published").order("sort_order"),
  ]);
  const authors = Object.fromEntries((authorsResult.data || []).map((row) => [row.id, row]));
  const revisions = Object.fromEntries((revisionsResult.data || []).map((row) => [row.id, row]));
  const mediaByPost = {};
  for (const row of mediaResult.data || []) {
    (mediaByPost[row.post_id] ||= []).push({
      id: row.id,
      resource_type: row.resource_type,
      url: row.resource_type === "video" ? videoUrl(row.public_id, row.version) : cloudinaryImageUrl({ publicId: row.public_id, version: row.version, width: 900, height: 900 }),
    });
  }

  return list.map((post) => {
    const revision = revisions[post.published_revision_id] || {};
    return {
      id: post.id,
      title: revision.title || "",
      body: revision.body || "",
      rating: revision.rating || null,
      verified_badge: !!post.verified_badge,
      published_at: post.published_at,
      author_name: authors[post.author_profile_id]?.full_name || "Member",
      media: mediaByPost[post.id] || [],
    };
  }).filter((post) => post.media.length);
}
