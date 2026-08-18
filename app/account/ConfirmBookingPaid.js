"use client";

import { useEffect } from "react";

export default function ConfirmBookingPaid() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    const bookingId = params.get("booking");
    if (!bookingId) return;
    fetch("/api/booking/confirm-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId }),
    }).then((res) => {
      if (res.ok) window.history.replaceState({}, "", "/account");
      if (res.ok) window.location.reload();
    }).catch(() => {});
  }, []);
  return null;
}
