/** Booking totals are stored in dollars. Stripe wants integer cents. */
export function dollarsToCents(amount) {
  const n = Number(amount) || 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function isBookingPaid(booking) {
  if (!booking) return false;
  if (booking.payment_received) return true;
  return ["paid", "authorized", "succeeded"].includes(String(booking.payment_status || ""));
}
