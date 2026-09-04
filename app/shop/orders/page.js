import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatShopPrice } from "@/lib/shop";
import { shopOrderLabel } from "@/lib/shopOrderNumber";
import { attachShopOrderDisplay } from "@/lib/shopOrderDisplay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your shop orders | Paw Sitter" };

function kolAction(post) {
  if (!post) return null;
  if (post.status === "draft") return { label: "Continue media review", className: "border border-[#c45c26] text-[#c45c26]" };
  if (post.status === "needs_changes") return { label: "Update media review", className: "border border-red-300 text-red-700" };
  if (post.status === "pending_admin") return { label: "Media review pending", className: "border border-amber-300 text-amber-900" };
  if (post.status === "published") return { label: "Media review published", className: "border border-green-300 text-green-800" };
  return null;
}

export default async function ShopOrdersPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/orders");
  const params = await searchParams;
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("shop_orders")
    .select("id, status, payment_status, discount_cents, discount_code, paw_points_cents, shipping_cents, shipping_label, shipping_method, created_at, shipping_city, seller_shop_id, shop:shop_shops!seller_shop_id(id, name, slug), items:shop_order_items(id, qty, price_cents, currency, product_id, product:shop_products(name, slug))")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const itemIds = (orders || []).flatMap((order) => (order.items || []).map((item) => item.id));
  const rated = new Set();
  const kolByItem = {};
  if (itemIds.length) {
    const admin = createAdminClient();
    const [{ data: existing }, { data: kolPosts }] = await Promise.all([
      admin.from("shop_product_reviews").select("order_item_id").in("order_item_id", itemIds),
      admin
        .from("shop_kol_posts")
        .select("id, verified_order_item_id, status, updated_at")
        .eq("author_profile_id", profile.id)
        .eq("source_type", "verified_purchase")
        .in("verified_order_item_id", itemIds)
        .in("status", ["draft", "needs_changes", "pending_admin", "published"])
        .order("updated_at", { ascending: false }),
    ]);
    for (const row of existing || []) rated.add(row.order_item_id);
    for (const post of kolPosts || []) {
      if (post.verified_order_item_id && !kolByItem[post.verified_order_item_id]) kolByItem[post.verified_order_item_id] = post;
    }
  }

  const listed = await attachShopOrderDisplay(supabase, orders || []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Your shop orders</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Each seller gets their own order.</p>
      {params?.placed ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Order placed. We split items by seller so each shop can fulfill their part.</p> : null}
      {params?.paid ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Payment confirmed.</p> : null}
      {params?.rated ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Thanks — your verified review is live.</p> : null}
      {!listed.length ? (
        <p className="mt-6 text-sm text-[#7a5c4e]">No shop orders yet. <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">Browse the shop</Link></p>
      ) : (
        <ul className="mt-6 space-y-4">
          {listed.map((order) => {
            const totals = order.display || {};
            const currency = order.items?.[0]?.currency || "CAD";
            const orderNo = shopOrderLabel(order.id);
            const shipName = order.shipping_label || (order.shipping_method ? String(order.shipping_method)[0].toUpperCase() + String(order.shipping_method).slice(1) : "Shipping");
            return (
              <li key={order.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#3b2a22]">
                      {order.shop?.slug ? <Link href={`/shop/shops/${order.shop.slug}`} className="text-[#c45c26] hover:underline">{order.shop.name}</Link> : order.shop?.name || "Shop"}
                      {orderNo ? <span className="font-semibold text-[#3b2a22]"> · {orderNo}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">{new Date(order.created_at).toLocaleString()} · {order.shipping_city || ""}</p>
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">{order.payment_status || "unpaid"}</p>
                  </div>
                  <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-semibold uppercase text-[#c45c26]">{order.status}</span>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {(order.items || []).map((item) => {
                    const action = kolAction(kolByItem[item.id]);
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          {item.product?.slug ? <Link href={`/shop/p/${item.product.slug}`} className="hover:underline">{item.product.name}</Link> : item.product?.name || "Product"}
                          <span className="text-[#7a5c4e]"> × {item.qty}</span>
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-[#c45c26]">{formatShopPrice((item.price_cents || 0) * (item.qty || 0), item.currency)}</span>
                          {order.status === "delivered" && !rated.has(item.id) ? <Link href={`/shop/rate/${item.id}`} className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white">Rate now</Link> : null}
                          {rated.has(item.id) ? <span className="text-xs text-[#7a5c4e]">Rated</span> : null}
                          {action ? <Link href={`/shop/rate/${item.id}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${action.className}`}>{action.label}</Link> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 space-y-0.5 text-sm">
                  <p className="text-[#7a5c4e]">Subtotal {formatShopPrice(totals.subtotal, currency)}</p>
                  {totals.discount ? <p className="text-green-700">Discount{order.discount_code ? ` (${order.discount_code})` : ""} −{formatShopPrice(totals.discount, currency)}</p> : null}
                  {totals.pointsCents ? <p className="text-green-700">Paw Points −{formatShopPrice(totals.pointsCents, currency)}</p> : null}
                  <p className="text-[#7a5c4e]">{shipName} {totals.shipping ? formatShopPrice(totals.shipping, currency) : "Free"}</p>
                  <p className="font-bold text-[#3b2a22]">Total {formatShopPrice(totals.total, currency)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
