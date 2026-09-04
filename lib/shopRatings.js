import { createAdminClient } from "@/lib/supabase/admin";
import { screenKolText } from "@/lib/kolTextModeration";

export async function optionsForProduct(productId) {
  const admin = createAdminClient();
  const { data: product } = await admin.from("shop_products").select("product_type").eq("id", productId).maybeSingle();
  const productType = product?.product_type || "other";
  const { data } = await admin
    .from("shop_rating_options")
    .select("id, product_type, label, description, icon_url, sort_order")
    .eq("product_type", productType)
    .order("sort_order");
  return data || [];
}

export async function reviewsForProduct(productId) {
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("shop_product_reviews")
    .select("id, rating, title, body, created_at, user_id")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  const list = reviews || [];
  if (!list.length) return [];
  const { data: ticks } = await admin
    .from("shop_product_review_ticks")
    .select("review_id, option:shop_rating_options(id, label, icon_url)")
    .in("review_id", list.map((r) => r.id));
  const byReview = {};
  for (const tick of ticks || []) {
    if (!byReview[tick.review_id]) byReview[tick.review_id] = [];
    if (tick.option) byReview[tick.review_id].push(tick.option);
  }
  return list.map((review) => ({ ...review, ticks: byReview[review.id] || [] }));
}

export async function reviewsForSlug(slug) {
  const admin = createAdminClient();
  const { data: product } = await admin.from("shop_products").select("id").eq("slug", slug).maybeSingle();
  if (!product) return { productId: "", reviews: [] };
  return { productId: product.id, reviews: await reviewsForProduct(product.id) };
}

async function ownsAnyShop(admin, profileId, shopIds) {
  const ids = [...new Set((shopIds || []).filter(Boolean))];
  if (!ids.length) return false;
  const { data } = await admin
    .from("shop_shops")
    .select("id")
    .eq("owner_profile_id", profileId)
    .in("id", ids)
    .limit(1);
  return (data || []).length > 0;
}

export async function canRateItem(itemId, profile, { allowExistingReview = false } = {}) {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("id, qty, refunded_qty, product_id, order_id, product:shop_products(id, name, slug, product_type, primary_shop_id, brand_shop_id), order:shop_orders(id, status, user_id, seller_shop_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.order?.user_id !== profile.id) return { ok: false, reason: "Order not found." };
  if (item.order?.status !== "delivered") return { ok: false, reason: "Rate after the seller marks this order delivered." };
  if (Number(item.refunded_qty || 0) >= Number(item.qty || 0)) return { ok: false, reason: "This item was fully refunded and is no longer a verified purchase." };
  const selfReview = await ownsAnyShop(admin, profile.id, [item.order?.seller_shop_id, item.product?.primary_shop_id, item.product?.brand_shop_id]);
  if (selfReview) return { ok: false, reason: "Shop and brand owners cannot rate their own products." };
  const { data: existing } = await admin.from("shop_product_reviews").select("id").eq("order_item_id", itemId).maybeSingle();
  if (existing && !allowExistingReview) return { ok: false, reason: "You already rated this item.", existing: true };
  const options = await optionsForProduct(item.product_id);
  return { ok: true, item, options, existingReview: existing || null };
}

export async function submitProductReview({ profile, itemId, rating, title, body, optionIds }) {
  const access = await canRateItem(itemId, profile);
  if (!access.ok) throw new Error(access.reason);
  const stars = Number(rating);
  const text = String(body || "").trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error("Choose 1 to 5 stars.");
  if (text.length < 8) throw new Error("Please write a short review.");
  const screened = screenKolText({ title, body: text });
  if (!screened.ok) throw new Error(screened.message);
  const admin = createAdminClient();
  const { data: review, error } = await admin
    .from("shop_product_reviews")
    .insert({ product_id: access.item.product_id, order_id: access.item.order_id, order_item_id: itemId, user_id: profile.id, rating: stars, title: String(title || "").trim(), body: text })
    .select("id")
    .single();
  if (error) throw error;
  const allowed = new Set(access.options.map((option) => option.id));
  const ticks = (optionIds || []).filter((id) => allowed.has(id)).map((option_id) => ({ review_id: review.id, option_id }));
  if (ticks.length) {
    const { error: tickErr } = await admin.from("shop_product_review_ticks").insert(ticks);
    if (tickErr) throw tickErr;
  }
  return review;
}
