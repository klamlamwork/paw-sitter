import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatShopPrice } from "@/lib/shop";
import { shopOrderLabel } from "@/lib/shopOrderNumber";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your shop orders | Paw Sitter" };

export default async function ShopOrdersPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/orders");
  const params = await searchParams;
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("shop_orders")
    .select("id, status, payment_status, discount_cents, discount_code, created_at, shipping_city, seller_shop_id, shop:shop_shops!seller_shop_id(id, name, slug), items:shop_order_items(id, qty, price_cents, currency, product_id, product:shop_products(name, slug))")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const itemIds = (orders || []).flatMap((o) => (o.items || []).map((i) => i.id));
  const rated = new Set();
  if (itemIds.length) {
    const admin = createAdminClient();
    const { data: existing } = await admin.from("shop_product_reviews").select("order_item_id").in("order_item_id", itemIds);
    for (const row of existing || []) rated.add(row.order_item_id);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Your shop orders</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Each seller gets their own order.</p>
      {params?.placed ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Order placed. We split items by seller so each shop can fulfill their part.</p> : null}
      {params?.paid ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Payment confirmed.</p> : null}
      {params?.rated ? <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Thanks — your verified review is live.</p> : null}
      {!orders?.length ? (
        <p className="mt-6 text-sm text-[#7a5c4e]">No shop orders yet. <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">Browse the shop</Link></p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => {
            const subtotal = (order.items || []).reduce((sum, item) => sum + (item.price_cents || 0) * (item.qty || 0), 0);
            const discount = order.discount_cents || 0;
            const total = Math.max(0, subtotal - discount);
            const currency = order.items?.[0]?.currency || "CAD";
            const orderNo = shopOrderLabel(order.id);
            return (
              <li key={order.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#3b2a22]">
                      {order.shop?.slug ? (
                        <Link href={`/shop/shops/${order.shop.slug}`} className="text-[#c45c26] hover:underline">{order.shop.name}</Link>
                      ) : (
                        order.shop?.name || "Shop"
                      )}
                      {orderNo ? <span className="font-semibold text-[#3b2a22]"> · {orderNo}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">{new Date(order.created_at).toLocaleString()} · {order.shipping_city || ""}</p>
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">{order.payment_status || "unpaid"}</p>
                  </div>
                  <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-semibold uppercase text-[#c45c26]">{order.status}</span>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {(order.items || []).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {item.product?.slug ? <Link href={`/shop/p/${item.product.slug}`} className="hover:underline">{item.product.name}</Link> : item.product?.name || "Product"}
                        <span className="text-[#7a5c4e]"> × {item.qty}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[#c45c26]">{formatShopPrice((item.price_cents || 0) * (item.qty || 0), item.currency)}</span>
                        {order.status === "delivered" && !rated.has(item.id) ? <Link href={`/shop/rate/${item.id}`} className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white">Rate now</Link> : null}
                        {rated.has(item.id) ? <span className="text-xs text-[#7a5c4e]">Rated</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-0.5 text-sm">
                  <p className="text-[#7a5c4e]">Subtotal {formatShopPrice(subtotal, currency)}</p>
                  {discount ? <p className="text-green-700">Discount{order.discount_code ? ` (${order.discount_code})` : ""} −{formatShopPrice(discount, currency)}</p> : null}
                  <p className="font-bold text-[#3b2a22]">Total {formatShopPrice(total, currency)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
