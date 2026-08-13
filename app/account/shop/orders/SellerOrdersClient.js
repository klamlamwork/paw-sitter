"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatShopPrice } from "@/lib/shop";

const NEXT = {
  pending: [
    { status: "accepted", label: "Accept" },
    { status: "declined", label: "Decline" },
  ],
  accepted: [{ status: "shipped", label: "Mark shipped" }],
};

const METHOD = {
  etransfer: "E-Transfer",
  pickup: "Pay at pickup",
  later: "Pay later",
};

export default function SellerOrdersClient({ initialOrders }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function patch(id, fields) {
    setBusyId(id);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_orders")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId("");
    if (err) {
      setError(err.message);
      return;
    }
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, ...fields } : o)));
  }

  if (!orders.length) {
    return <p className="mt-6 text-sm text-[#7a5c4e]">No orders yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {orders.map((order) => {
        const total = (order.items || []).reduce(
          (sum, item) => sum + (item.price_cents || 0) * (item.qty || 0),
          0
        );
        const currency = order.items?.[0]?.currency || "CAD";
        const actions = NEXT[order.status] || [];
        return (
          <article key={order.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#3b2a22]">{order.shop?.name || "Your shop"}</p>
                <p className="text-xs text-[#7a5c4e]">{new Date(order.created_at).toLocaleString()}</p>
                <p className="text-xs text-[#7a5c4e]">
                  {METHOD[order.payment_method] || order.payment_method || "Payment"} · {order.payment_status || "unpaid"}
                </p>
              </div>
              <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-semibold uppercase text-[#c45c26]">
                {order.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-[#7a5c4e]">Ship to</p>
            <p className="text-sm text-[#3b2a22]">
              {order.shipping_name}
              {order.shipping_phone ? ` · ${order.shipping_phone}` : ""}
            </p>
            <p className="text-sm text-[#5c4033]">
              {[order.shipping_line1, order.shipping_line2, order.shipping_city, order.shipping_state, order.shipping_postal_code, order.shipping_country]
                .filter(Boolean)
                .join(", ")}
            </p>
            {order.shipping_email ? <p className="text-xs text-[#7a5c4e]">{order.shipping_email}</p> : null}
            <ul className="mt-3 space-y-1">
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
            <p className="mt-2 font-bold text-[#3b2a22]">Total {formatShopPrice(total, currency)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.status}
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => patch(order.id, { status: a.status })}
                  className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busyId === order.id ? "Saving…" : a.label}
                </button>
              ))}
              {order.payment_status !== "paid" ? (
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => patch(order.id, { payment_status: "paid", paid_at: new Date().toISOString() })}
                  className="rounded-full border border-[#c45c26] px-4 py-1.5 text-xs font-semibold text-[#c45c26] disabled:opacity-60"
                >
                  Mark paid
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
