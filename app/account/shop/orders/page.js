import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellerOrdersClient from "./SellerOrdersClient";
import { attachShopOrderDisplay } from "@/lib/shopOrderDisplay";

export const metadata = { title: "Shop orders | Paw Sitter" };

export default async function SellerOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/shop/orders");

  const { data: shop } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", user.id).maybeSingle();
  if (!shop) redirect("/account/shop");

  const { data: orders } = await supabase
    .from("shop_orders")
    .select("id, status, payment_status, payment_method, discount_cents, discount_code, paw_points_cents, paw_points_redeemed, shipping_cents, shipping_label, shipping_method, created_at, delivered_at, return_window_ends_at, shipping_name, shipping_phone, shipping_email, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, shop:shop_shops!seller_shop_id(id, name), items:shop_order_items(id, qty, price_cents, currency, refund_status, refunded_qty, product:shop_products(name, slug))")
    .eq("seller_shop_id", shop.id)
    .order("created_at", { ascending: false });

  const initialOrders = await attachShopOrderDisplay(supabase, orders || []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Shop orders</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Totals include shipping and any promo applied at checkout.</p>
      <SellerOrdersClient initialOrders={initialOrders} />
    </div>
  );
}
