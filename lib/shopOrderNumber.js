export function shopOrderNumber(id) {
  if (!id) return "";
  return String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function shopOrderLabel(id) {
  const n = shopOrderNumber(id);
  return n ? `Order #${n}` : "";
}

export function bookingOrderLabel(id) {
  const n = shopOrderNumber(id);
  return n ? `Booking #${n}` : "";
}
