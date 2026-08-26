"use client";

import { useEffect } from "react";

export default function StripeReturnHandler() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("canceled") !== "1") return;

    // Never clear the cart on return. A verified Stripe webhook clears it only
    // after checkout.session.completed.
    fetch("/api/shop/checkout/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canceled: true }),
    }).catch(() => {});
  }, []);
  return null;
}
