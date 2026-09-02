import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SellerItemRefundButton from "../SellerItemRefundButton";

export const metadata = { title: "Seller order | Paw Sitter" };

export default async function SellerShopOrderDetailPage({ params }) {
  const { orderId } = await params;
  let profile;
  try {
    profile = await getProfile();
  } catch {
    redirect(`/login?next=/account/shop/orders/${orderId}`);
  }
  if (!profile) redirect(`/login?next=/account/shop/orders/${orderId}`);

  const supabase = await createClient();
  const { data: shops } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", profile.id);
  const shopIds = (shops || []).map((s) => s.id);
  if (!shopIds.length) redirect("/account/shop");

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, order_number, shop_id, status, payment_status, refund_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || !shopIds.includes(order.shop_id)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/account/shop/orders" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop orders</Link>
        <h1 className="mt-4 text-2xl font-bold text-[#3b2a22]">Order not found</h1>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("shop_order_items")
    .select("id, qty, price_cents, refund_status, refund_cents, product:shop_products(name)")
    .eq("order_id", order.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account/shop/orders" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop orders</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Order {order.order_number || order.id.slice(0, 8)}</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Payment {order.payment_status} · Refund {order.refund_status || "none"}</p>
      <ul className="mt-6 space-y-3">
        {(items || []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#3b2a22]">{item.product?.name || "Item"}</p>
              <p className="text-xs text-[#7a5c4e]">Qty {item.qty} · {((item.price_cents || 0) * (item.qty || 1) / 100).toFixed(2)} CAD</p>
            </div>
            <SellerItemRefundButton orderItemId={item.id} refundStatus={item.refund_status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
