import { createClient } from "@/lib/supabase/client";

const GUEST_KEY = "paw_shop_cart_v1";

export function emptyCart() {
  return { items: [] };
}

export function readGuestCart() {
  if (typeof window === "undefined") return emptyCart();
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw);
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return emptyCart();
  }
}

export function writeGuestCart(cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_KEY, JSON.stringify({ items: cart.items || [] }));
}

export function cartCount(items) {
  return (items || []).reduce((n, i) => n + (i.qty || 0), 0);
}

export function cartSubtotalCents(items) {
  return (items || []).reduce((n, i) => n + (i.price_cents || 0) * (i.qty || 0), 0);
}

function lineKey(item) {
  return `${item.product_id}::${item.variant_id || "none"}::${item.shop_id}`;
}

export function mergeLine(items, incoming) {
  const key = lineKey(incoming);
  const next = [...(items || [])];
  const idx = next.findIndex((i) => lineKey(i) === key);
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      ...incoming,
      qty: Math.min(99, (next[idx].qty || 0) + (incoming.qty || 1)),
    };
  } else {
    next.push({ ...incoming, qty: incoming.qty || 1 });
  }
  return next;
}

export async function resolvePosterShop(supabase, productId, fallbackShopId) {
  const { data: product } = await supabase
    .from("shop_products")
    .select("brand_shop_id, primary_shop_id")
    .eq("id", productId)
    .maybeSingle();
  const sellerId = product?.brand_shop_id || product?.primary_shop_id || fallbackShopId;
  if (!sellerId) return { shop_id: fallbackShopId, shop_name: "Shop", shop_slug: "" };
  const { data: shop } = await supabase
    .from("shop_shops")
    .select("id, name, slug")
    .eq("id", sellerId)
    .maybeSingle();
  return {
    shop_id: shop?.id || sellerId,
    shop_name: shop?.name || "Shop",
    shop_slug: shop?.slug || "",
  };
}

export async function ensureUserCart(supabase, userId) {
  const { data: existing } = await supabase
    .from("shop_carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("shop_carts")
    .insert({ user_id: userId, updated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function loadUserCartItems(supabase, userId) {
  const cartId = await ensureUserCart(supabase, userId);
  const { data, error } = await supabase
    .from("shop_cart_items")
    .select(
      "id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(id, name, slug, brand_shop_id, primary_shop_id), variant:shop_product_variants(id, name), shop:shop_shops(id, name, slug)"
    )
    .eq("cart_id", cartId);
  if (error) throw error;

  const brandIds = [
    ...new Set((data || []).map((row) => row.product?.brand_shop_id).filter(Boolean)),
  ];
  const brandById = {};
  if (brandIds.length) {
    const { data: brands } = await supabase
      .from("shop_shops")
      .select("id, name, slug")
      .in("id", brandIds);
    for (const b of brands || []) brandById[b.id] = b;
  }

  return (data || []).map((row) => {
    const poster = row.product?.brand_shop_id
      ? brandById[row.product.brand_shop_id] || row.shop
      : row.shop;
    return {
      id: row.id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      shop_id: poster?.id || row.shop_id,
      qty: row.qty,
      price_cents: row.price_cents,
      currency: row.currency || "CAD",
      name: row.product?.name || "Product",
      slug: row.product?.slug || "",
      variant_name: row.variant?.name || "",
      shop_name: poster?.name || "Shop",
      shop_slug: poster?.slug || "",
      image: "",
    };
  });
}

export async function addUserCartItem(supabase, userId, line) {
  const cartId = await ensureUserCart(supabase, userId);
  const { data: existing } = await supabase
    .from("shop_cart_items")
    .select("id, qty")
    .eq("cart_id", cartId)
    .eq("product_id", line.product_id)
    .eq("shop_id", line.shop_id)
    [line.variant_id ? "eq" : "is"]("variant_id", line.variant_id || null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("shop_cart_items")
      .update({
        qty: Math.min(99, (existing.qty || 0) + (line.qty || 1)),
        price_cents: line.price_cents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("shop_cart_items").insert({
    cart_id: cartId,
    product_id: line.product_id,
    variant_id: line.variant_id || null,
    shop_id: line.shop_id,
    qty: line.qty || 1,
    price_cents: line.price_cents,
    currency: line.currency || "CAD",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function setUserCartQty(supabase, itemId, qty) {
  if (qty <= 0) {
    const { error } = await supabase.from("shop_cart_items").delete().eq("id", itemId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("shop_cart_items")
    .update({ qty: Math.min(99, qty), updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw error;
}

export async function removeUserCartItem(supabase, itemId) {
  const { error } = await supabase.from("shop_cart_items").delete().eq("id", itemId);
  if (error) throw error;
}

export function createClientOrNull() {
  try {
    return createClient();
  } catch {
    return null;
  }
}
