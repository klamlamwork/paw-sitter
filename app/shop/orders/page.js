import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShopPrice } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your shop orders | Paw Sitter",
};

function payLabel(order) {
  const method = {
    etransfer: "E-Transfer",
    pickup: "Pay at pickup",
    later: "Pay later",
  }[order.payment_method] || order.payment_method || "Payment";
  const status = order.payment_status || "unpaid";
  return `${method} · ${status}`;
}

export default async function ShopOrdersPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/orders");

  const params = await searchParams;
  const placed = params?.placed;

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("shop_orders")
    .select(
      "id, status, created_at, shipping_city, payment_method, payment_status, seller_shop_id, shop:shop_shops!seller_shop_id(id, name, slug), items:shop_order_items(id, qty, price_cents, currency, product:shop_products(name, slug))"
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Your shop orders</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Each seller gets their own order.</p>

      {placed ? (
        <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
          Order placed. We split items by seller so each shop can fulfill their part.
        </p>
      ) : null}

      {!orders?.length ? (
        <p className="mt-6 text-sm text-[#7a5c4e]">
          No shop orders yet.{" "}
          <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">
            Browse the shop
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => {
            const total = (order.items || []).reduce(
              (sum, item) => sum + (item.price_cents || 0) * (item.qty || 0),
              0
            );
            const currency = order.items?.[0]?.currency || "CAD";
            return (
              <li key={order.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {order.shop?.slug ? (
                      <Link
                        href={`/shop/shops/${order.shop.slug}`}
                        className="text-sm font-semibold text-[#c45c26] hover:underline"
                      >
                        {order.shop.name}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-[#3b2a22]">{order.shop?.name || "Shop"}</p>
                    )}
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">
                      {new Date(order.created_at).toLocaleString()} · {order.shipping_city || ""}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7a5c4e]">{payLabel(order)}</p>
                  </div>
                  <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-semibold uppercase text-[#c45c26]">
                    {order.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(order.items || []).map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.product?.slug ? (
                          <Link href={`/shop/p/${item.product.slug}`} className="hover:underline">
                            {item.product.name}
                          </Link>
                        ) : (
                          item.product?.name || "Product"
                        )}
                        <span className="text-[#7a5c4e]"> × {item.qty}</span>
                      </span>
                      <span className="text-[#c45c26]">
                        {formatShopPrice((item.price_cents || 0) * (item.qty || 0), item.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-bold text-[#3b2a22]">
                  Total {formatShopPrice(total, currency)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
