"use client";

import { useEffect, useState } from "react";
import SitterCancelBooking from "./SitterCancelBooking";

export default function ReviewBookingButton({ bookingId, label = "Write a review" }) {
  const [state, setState] = useState(null);
  const showSitterCancel = label === "Review pets";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reviews/start?booking_id=${encodeURIComponent(bookingId)}`);
        const data = await res.json();
        if (!cancelled && res.ok) setState(data);
      } catch {
        if (!cancelled) setState({ finished: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const reviewLink = state?.finished && !state.submitted && state.url ? (
    <a href={state.url} className="mt-2 inline-flex rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white">
      {label}
    </a>
  ) : null;

  if (!showSitterCancel && !reviewLink) return null;

  return (
    <div className="mt-3 space-y-2">
      {showSitterCancel ? <SitterCancelBooking bookingId={bookingId} /> : null}
      {reviewLink}
    </div>
  );
}
