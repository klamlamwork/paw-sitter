"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerItemRefundButton({ orderItemId, remainingQty = 1 }) {
  const router = useRouter();
  const max = Math.max(1, Number(remainingQty) || 1);
  const [qty, setQty] = useState(max === 1 ? 1 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refundItem() {
    const n = Math.max(1, Math.min(max, Math.floor(Number(qty) || 1)));
    if (!confirm(`Refund ${n} of this item to the customer in Stripe? Paw Points earned on this quantity will be deducted.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/orders/item-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, qty: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not refund item.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not refund item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {max > 1 ? (
        <label className="text-xs text-[#7a5c4e]">
          Qty
          <input
            type="number"
            min={1}
            max={max}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="ml-1 w-14 border border-[#e8d5c4] px-1 py-0.5 text-xs"
          />
        </label>
      ) : null}
      <button type="button" disabled={busy} onClick={refundItem} className="rounded-full bg-[#c45c26] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {busy ? "Refunding…" : "Refund this item"}
      </button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
