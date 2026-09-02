"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerItemRefundButton({ orderItemId, refundStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if ((refundStatus || "none") === "refunded") {
    return <p className="text-xs font-semibold text-green-800">Refunded</p>;
  }

  async function refundItem() {
    if (!confirm("Refund this item to the customer in Stripe? Paw Points earned on this item will be deducted.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/orders/item-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId }),
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
    <div>
      <button type="button" disabled={busy} onClick={refundItem} className="rounded-full bg-[#c45c26] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {busy ? "Refunding…" : "Refund this item"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
