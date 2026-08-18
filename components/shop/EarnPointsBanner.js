"use client";

import { useEffect, useState } from "react";

export default function EarnPointsBanner({ cents = 0, productType = "other" }) {
  const [pts, setPts] = useState(null);
  useEffect(() => {
    fetch("/api/paw-points/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_cents: cents, points: 0, items: [{ net_cents: cents, qty: 1, product_type: productType }] }),
    }).then((r) => r.json()).then((d) => setPts(d.earn_points || 0)).catch(() => {});
  }, [cents, productType]);
  if (!pts) return null;
  return <p className="text-xs font-semibold text-[#c45c26]">Earn {pts} Paw Points on this order</p>;
}
