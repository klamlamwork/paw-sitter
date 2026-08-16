import { createAdminClient } from "@/lib/supabase/admin";

export async function optionsForProduct(productId) {
  const admin = createAdminClient();
  const { data: links } = await admin.from("shop_product_categories").select("category_id").eq("product_id", productId);
  const ids = [...new Set((links || []).map((r) => r.category_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data } = await admin.from("shop_rating_options").select("id, category_id, label, description, icon_url, sort_order").in("category_id", ids).order("sort_order");
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
  for (const t of ticks || []) {
    if (!byReview[t.review_id]) byReview[t.review_id] = [];
    if (t.option) byReview[t.review_id].push(t.option);
  }
  return list.map((r) => ({ ...r, ticks: byReview[r.id] || [] }));
}

export async function reviewsForSlug(slug) {
  const admin = createAdminClient();
  const { data: product } = await admin.from("shop_products").select("id").eq("slug", slug).maybeSingle();
  if (!product) return { productId: "", reviews: [] };
  return { productId: product.id, reviews: await reviewsForProduct(product.id) };
}

export async function canRateItem(itemId, profile) {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("shop_order_items")
    .select("id, product_id, order_id, product:shop_products(id, name, slug), order:shop_orders(id, status, user_id)")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.order?.user_id !== profile.id) return { ok: false, reason: "Order not found." };
  if (item.order?.status !== "delivered") return { ok: false, reason: "Rate after the seller marks this order delivered." };
  const { data: existing } = await admin.from("shop_product_reviews").select("id").eq("order_item_id", itemId).maybeSingle();
  if (existing) return { ok: false, reason: "You already rated this item.", existing: true };
  const options = await optionsForProduct(item.product_id);
  return { ok: true, item, options };
}

export async function submitProductReview({ profile, itemId, rating, title, body, optionIds }) {
  const access = await canRateItem(itemId, profile);
  if (!access.ok) throw new Error(access.reason);
  const stars = Number(rating);
  const text = String(body || "").trim();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error("Choose 1 to 5 stars.");
  if (text.length < 8) throw new Error("Please write a short review.");
  const admin = createAdminClient();
  const { data: review, error } = await admin
    .from("shop_product_reviews")
    .insert({
      product_id: access.item.product_id,
      order_id: access.item.order_id,
      order_item_id: itemId,
      user_id: profile.id,
      rating: stars,
      title: String(title || "").trim(),
      body: text,
    })
    .select("id")
    .single();
  if (error) throw error;
  const allowed = new Set(access.options.map((o) => o.id));
  const ticks = (optionIds || []).filter((id) => allowed.has(id)).map((option_id) => ({ review_id: review.id, option_id }));
  if (ticks.length) {
    const { error: tErr } = await admin.from("shop_product_review_ticks").insert(ticks);
    if (tErr) throw tErr;
  }
  return review;
}
