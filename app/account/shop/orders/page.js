import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SellerOrdersClient from "./SellerOrdersClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shop orders | Paw Sitter" };

export default async function SellerShopOrdersPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account/shop/orders");

  const supabase = await createClient();
  const { data: shops } = await supabase
    .from("shop_shops")
    .select("id, name, slug")
    .eq("owner_profile_id", profile.id)
    .order("name");

  const shopIds = (shops || []).map((s) => s.id);
  let orders = [];
  if (shopIds.length) {
    const { data } = await supabase
      .from("shop_orders")
      .select(
        "id, status, created_at, shipping_name, shipping_email, shipping_phone, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal_code, shipping_country, payment_method, payment_status, seller_shop_id, shop:shop_shops!seller_shop_id(id, name), items:shop_order_items(id, qty, price_cents, currency, product:shop_products(name, slug))"
      )
      .in("seller_shop_id", shopIds)
      .order("created_at", { ascending: false });
    orders = data || [];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop portal
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Incoming orders</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Accept, ship, or mark payment received.</p>
      {!shopIds.length ? (
        <p className="mt-6 text-sm text-[#5c4033]">No shop is linked to this account.</p>
      ) : (
        <SellerOrdersClient initialOrders={orders} />
      )}
    </div>
  );
}
