"use client";

import { useState } from "react";
import Link from "next/link";
import { formatShopPrice } from "@/lib/shop";
import SellerItemRefundButton from "./SellerItemRefundButton";

const NEXT = {
  pending: [
    { status: "accepted", label: "Accept" },
    { status: "declined", label: "Decline" },
  ],
  accepted: [{ status: "shipped", label: "Mark shipped" }],
  shipped: [{ status: "delivered", label: "Mark delivered" }],
};

const REFUND_MS = 7 * 24 * 60 * 60 * 1000;

function remainingQty(item) {
  return Math.max(0, Math.floor(Number(item?.qty || 0) - Number(item?.refunded_qty || 0)));
}

function canRefundItem(order, item, now = new Date()) {
  if (!order || !item) return false;
  if (order.status === "declined") return false;
  if (remainingQty(item) <= 0) return false;
  if ((item.refund_status || "none") === "refunded") return false;
  const delivered = order.status === "delivered" || !!order.delivered_at;
  if (!delivered) return true;
  const ends = [];
  if (order.return_window_ends_at) {
    const t = new Date(order.return_window_ends_at).getTime();
    if (!Number.isNaN(t)) ends.push(t);
  }
  if (order.delivered_at) {
    const t = new Date(order.delivered_at).getTime();
    if (!Number.isNaN(t)) ends.push(t + REFUND_MS);
  }
  if (!ends.length) return false;
  return now.getTime() < Math.min(...ends);
}

export default function SellerOrdersClient({ initialOrders }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function setStatus(id, status) {
    setBusyId(id);
    setError("");
    const res = await fetch("/api/shop/orders/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) {
      setError(data.error || "Could not update");
      return;
    }
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, status, delivered_at: status === "delivered" ? o.delivered_at || new Date().toISOString() : o.delivered_at } : o)));
  }

  if (!orders.length) {
    return <p className="mt-6 text-sm text-[#7a5c4e]">No orders yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {orders.map((order) => {
        const subtotal = (order.items || []).reduce((sum, item) => sum + (item.price_cents || 0) * (item.qty || 0), 0);
        const discount = order.discount_cents || 0;
        const shipping = Number(order.shipping_cents) || 0;
        const total = Math.max(0, subtotal - discount) + shipping;
        const currency = order.items?.[0]?.currency || "CAD";
        const actions = NEXT[order.status] || [];
        const shipName = order.shipping_label || (order.shipping_method ? String(order.shipping_method)[0].toUpperCase() + String(order.shipping_method).slice(1) : "Shipping");
        return (
          <article key={order.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#3b2a22]">{order.shop?.name || "Your shop"}</p>
                <p className="text-xs text-[#7a5c4e]">{new Date(order.created_at).toLocaleString()}</p>
                <p className="text-xs text-[#7a5c4e]">{order.payment_method || "Payment"} · {order.payment_status || "unpaid"}</p>
              </div>
              <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs font-semibold uppercase text-[#c45c26]">{order.status}</span>
            </div>
            <p className="mt-3 text-xs text-[#7a5c4e]">Ship to</p>
            <p className="text-sm text-[#3b2a22]">{order.shipping_name}{order.shipping_phone ? ` · ${order.shipping_phone}` : ""}</p>
            <p className="text-sm text-[#5c4033]">{[order.shipping_line1, order.shipping_line2, order.shipping_city, order.shipping_state, order.shipping_postal_code, order.shipping_country].filter(Boolean).join(", ")}</p>
            {order.shipping_email ? <p className="text-xs text-[#7a5c4e]">{order.shipping_email}</p> : null}
            <ul className="mt-3 space-y-2">
              {(order.items || []).map((item) => {
                const remaining = remainingQty(item);
                const showRefund = canRefundItem(order, item);
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      {item.product?.slug ? <Link href={`/shop/p/${item.product.slug}`} className="hover:underline">{item.product.name}</Link> : item.product?.name || "Product"}
                      <span className="text-[#7a5c4e]"> × {item.qty}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[#c45c26]">{formatShopPrice((item.price_cents || 0) * (item.qty || 0), item.currency)}</span>
                      {showRefund ? <SellerItemRefundButton orderItemId={item.id} remainingQty={remaining} /> : remaining <= 0 ? <span className="text-xs font-semibold text-green-800">Refunded</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 space-y-0.5 text-sm">
              <p className="text-[#7a5c4e]">Subtotal {formatShopPrice(subtotal, currency)}</p>
              {discount ? <p className="text-green-700">Discount{order.discount_code ? ` (${order.discount_code})` : ""} −{formatShopPrice(discount, currency)}</p> : null}
              <p className="text-[#7a5c4e]">{shipName} {shipping ? formatShopPrice(shipping, currency) : "Free"}</p>
              <p className="font-bold text-[#3b2a22]">Total {formatShopPrice(total, currency)}</p>
            </div>
            {actions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a.status}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => setStatus(order.id, a.status)}
                    className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busyId === order.id ? "Saving…" : a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
