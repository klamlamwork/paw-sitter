import { createAdminClient } from "@/lib/supabase/admin";

export async function recentStandardReviews(limit = 50) {
  const admin = createAdminClient();
  const { data: reviews } = await admin.from("shop_product_reviews").select("id, rating, title, body, created_at, user_id, order_item_id, product_id").order("created_at", { ascending: false }).limit(limit);
  const list = reviews || [];
  if (!list.length) return [];
  const productIds = [...new Set(list.map((row) => row.product_id).filter(Boolean))];
  const userIds = [...new Set(list.map((row) => row.user_id).filter(Boolean))];
  const itemIds = [...new Set(list.map((row) => row.order_item_id).filter(Boolean))];
  const [productsResult, usersResult, itemsResult] = await Promise.all([
    productIds.length ? admin.from("shop_products").select("id, name, slug").in("id", productIds) : { data: [] },
    userIds.length ? admin.from("profiles").select("id, full_name").in("id", userIds) : { data: [] },
    itemIds.length ? admin.from("shop_order_items").select("id, qty, refunded_qty").in("id", itemIds) : { data: [] },
  ]);
  const products = Object.fromEntries((productsResult.data || []).map((row) => [row.id, row]));
  const users = Object.fromEntries((usersResult.data || []).map((row) => [row.id, row]));
  const items = Object.fromEntries((itemsResult.data || []).map((row) => [row.id, row]));
  return list.map((review) => {
    const item = items[review.order_item_id];
    const product = products[review.product_id];
    return {
      id: review.id,
      rating: review.rating,
      title: review.title || "",
      body: review.body || "",
      created_at: review.created_at,
      author_name: users[review.user_id]?.full_name || "Member",
      verified_purchase: item ? Number(item.refunded_qty || 0) < Number(item.qty || 0) : true,
      product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
    };
  });
}
