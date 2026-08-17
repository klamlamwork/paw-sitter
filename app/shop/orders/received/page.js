import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/discounts";

export const metadata = { title: "Order Received | Paw Sitter" };

export default async function OrderReceivedPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/orders");

  const { data: orders } = await supabase
    .from("shop_orders")
    .select("id, seller_shop_id, status, payment_status, discount_cents, created_at, items:shop_order_items(qty, price_cents)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const placed = searchParams?.placed === "1";
  const paid = searchParams?.paid === "1";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">{paid ? "Payment successful" : placed ? "Order placed" : "Order received"}</h1>
      {paid ? <p className="mt-2 text-sm text-green-700">Your payment was confirmed. Thank you!</p> : null}
      <ul className="mt-6 space-y-3 text-sm">
        {(orders || []).map((o) => {
          const subtotal = (o.items || []).reduce((s, i) => s + (i.price_cents || 0) * (i.qty || 1), 0);
          const discount = o.discount_cents || 0;
          const total = Math.max(0, subtotal - discount);
          return (
            <li key={o.id} className="rounded-xl border border-[#e8d5c4] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Order {o.id.slice(0, 8)}</p>
                <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs capitalize text-[#c45c26]">{o.payment_status}</span>
              </div>
              <p className="mt-1 text-[#7a5c4e]">{new Date(o.created_at).toLocaleString()}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[#7a5c4e]">Subtotal {money(subtotal)}</span>
                {discount ? <span className="text-green-700">− Discount {money(discount)}</span> : null}
                <span className="font-semibold">Total {money(total)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <a href="/shop" className="mt-6 inline-block rounded-full bg-[#c45c26] px-6 py-2 text-sm font-semibold text-white">Continue shopping</a>
    </div>
  );
}
