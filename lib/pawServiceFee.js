export const PAW_SERVICE_FEE_PCT = 10;

export function serviceFeeCents(subtotalCents) {
  return Math.round(Math.max(0, Number(subtotalCents) || 0) * (PAW_SERVICE_FEE_PCT / 100));
}

/** Customer pays sitter rate + 10% fee. Promo/points reduce the fee first, never the sitter payout. */
export function quoteBookingCustomerTotal({ subtotalCents, promoCents = 0, pointsCents = 0 }) {
  const subtotal = Math.max(0, Math.floor(Number(subtotalCents) || 0));
  const fee = serviceFeeCents(subtotal);
  const discounts = Math.max(0, (Number(promoCents) || 0) + (Number(pointsCents) || 0));
  const feeAfter = Math.max(0, fee - discounts);
  const unusedDiscount = Math.max(0, discounts - fee);
  const customerPay = subtotal + feeAfter;
  return {
    subtotalCents: subtotal,
    feeCents: fee,
    feeAfterDiscountCents: feeAfter,
    unusedDiscountCents: unusedDiscount,
    customerPayCents: customerPay,
    sitterPayoutCents: subtotal,
    applicationFeeCents: feeAfter,
    earnBaseCents: subtotal,
    maxDiscountCents: fee,
  };
}
