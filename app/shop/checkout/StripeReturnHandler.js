"use client";

import { useEffect } from "react";

export default function StripeReturnHandler() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const canceled = q.get("canceled") === "1";
    const paid = q.get("paid") === "1" || q.get("placed") === "1";
    if (!canceled && !paid) return;
    fetch("/api/shop/checkout/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canceled, paid }),
    }).catch(() => {});
  }, []);
  return null;
}
