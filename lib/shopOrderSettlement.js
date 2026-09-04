import { earnPointsForItems } from "@/lib/pawPoints";

function asInt(n) {
  return Math.max(0, Math.floor(Number(n) || 0));
}

export function allocateByWeight(total, weights) {
  const t = asInt(total);
  const w = (weights || []).map((n) => Math.max(0, Number(n) || 0));
  if (!w.length) return [];
  const sum = w.reduce((a, b) => a + b, 0);
  if (t <= 0 || sum <= 0) return w.map(() => 0);
  const out = w.map((x) => Math.floor((t * x) / sum));
  out[out.length - 1] += t - out.reduce((a, b) => a + b, 0);
  return out;
}

export function splitEscrow(baseCents, commissionPct = 10) {
  const base = asInt(baseCents);
  const pct = Math.max(0, Number(commissionPct) || 0);
  const platform = Math.round((base * pct) / 100);
  return {
    base_cents: base,
    seller_escrow_cents: Math.max(0, base - platform),
    platform_escrow_cents: Math.max(0, platform),
  };
}

function lineMerchandise(item) {
  return asInt(item.price_cents ?? item.priceCents) * Math.max(0, Math.floor(Number(item.qty || 0)));
}

function sellerDiscountCents(seller, discountCents, discountBreakdown) {
  const merch = (seller.items || []).reduce((sum, item) => sum + lineMerchandise(item), 0);
  const rows = discountBreakdown || [];
  if (!rows.length) return null;
  const hit = rows.find((row) => String(row.vendorId || row.vendor_id || "") === String(seller.sellerShopId || seller.seller_shop_id || ""));
  if (hit) return asInt(hit.discount);
  return null;
}

export function allocateShopSettlements({
  sellers = [],
  discountCents = 0,
  discountSponsor = "none",
  discountBreakdown = [],
  pointsRedeemed = 0,
  pointsRedeemedCents = 0,
  commissionPct = 10,
  rates = {},
  defaultEarnRate = 10,
} = {}) {
  const sponsor = ["vendor", "platform"].includes(discountSponsor) ? discountSponsor : "none";
  const totalDiscount = asInt(discountCents);
  const totalPoints = asInt(pointsRedeemed);
  const totalPointCents = asInt(pointsRedeemedCents);
  const merchWeights = sellers.map((seller) => (seller.items || []).reduce((sum, item) => sum + lineMerchandise(item), 0));
  const fromBreakdown = sellers.map((seller) => sellerDiscountCents(seller, totalDiscount, discountBreakdown));
  const sellerDiscounts = fromBreakdown.every((n) => n == null)
    ? allocateByWeight(totalDiscount, merchWeights)
    : fromBreakdown.map((n) => asInt(n));
  if (sellerDiscounts.length) {
    const drift = totalDiscount - sellerDiscounts.reduce((a, b) => a + b, 0);
    if (drift && sellerDiscounts.length) sellerDiscounts[sellerDiscounts.length - 1] += drift;
  }
  const afterDiscWeights = merchWeights.map((merch, i) => Math.max(0, merch - (sellerDiscounts[i] || 0)));
  const sellerPointCents = allocateByWeight(totalPointCents, afterDiscWeights);
  const sellerPoints = allocateByWeight(totalPoints, afterDiscWeights);

  const orders = [];
  const items = [];

  sellers.forEach((seller, sellerIdx) => {
    const rows = seller.items || [];
    const merch = merchWeights[sellerIdx] || 0;
    const discount = Math.min(merch, asInt(sellerDiscounts[sellerIdx]));
    const shipping = asInt(seller.shippingCents ?? seller.shipping_cents);
    const pointCents = asInt(sellerPointCents[sellerIdx]);
    const points = asInt(sellerPoints[sellerIdx]);
    const itemMerch = rows.map(lineMerchandise);
    const itemDiscount = allocateByWeight(discount, itemMerch);
    const itemPointCents = allocateByWeight(pointCents, itemMerch);
    const itemPoints = allocateByWeight(points, itemMerch);
    const earnItems = rows.map((item, i) => {
      const net = Math.max(0, itemMerch[i] - itemDiscount[i] - itemPointCents[i]);
      return { product_type: item.product_type || item.productType || "other", qty: 1, net_cents: net };
    });
    const itemEarn = rows.map((item, i) => earnPointsForItems([earnItems[i]], rates, defaultEarnRate));
    const vendorBaseLines = itemMerch.map((m, i) => (sponsor === "vendor" ? Math.max(0, m - itemDiscount[i]) : m));
    const itemSplits = vendorBaseLines.map((base) => splitEscrow(base, commissionPct));
    const shipSplit = splitEscrow(shipping, commissionPct);
    let platformCut = itemSplits.reduce((sum, s) => sum + s.platform_escrow_cents, 0) + shipSplit.platform_escrow_cents;
    const platformTakes = sponsor === "platform" ? discount + pointCents : pointCents;
    platformCut = Math.max(0, platformCut - platformTakes);
    const itemPlatform = allocateByWeight(
      Math.max(0, platformCut - shipSplit.platform_escrow_cents),
      itemSplits.map((s) => s.platform_escrow_cents)
    );
    const sellerEscrow = itemSplits.reduce((sum, s) => sum + s.seller_escrow_cents, 0) + shipSplit.seller_escrow_cents;
    const displayTotal = Math.max(0, merch - discount - pointCents) + shipping;

    orders.push({
      order_id: seller.orderId || seller.order_id || null,
      seller_shop_id: seller.sellerShopId || seller.seller_shop_id || null,
      merchandise_cents: merch,
      discount_cents: discount,
      discount_sponsor: discount ? sponsor : "none",
      shipping_cents: shipping,
      points_redeemed: points,
      points_redeemed_cents: pointCents,
      points_earned: itemEarn.reduce((a, b) => a + b, 0),
      seller_escrow_cents: sellerEscrow,
      platform_escrow_cents: platformCut,
      display_total_cents: displayTotal,
      shipping_seller_escrow_cents: shipSplit.seller_escrow_cents,
      shipping_platform_escrow_cents: Math.min(shipSplit.platform_escrow_cents, platformCut),
    });

    rows.forEach((item, i) => {
      items.push({
        order_id: seller.orderId || seller.order_id || null,
        order_item_id: item.id || item.orderItemId || item.order_item_id || null,
        qty: Math.max(0, Math.floor(Number(item.qty || 0))),
        merchandise_cents: itemMerch[i],
        discount_cents: itemDiscount[i],
        discount_sponsor: itemDiscount[i] ? (discount ? sponsor : "none") : "none",
        points_redeemed: itemPoints[i],
        points_redeemed_cents: itemPointCents[i],
        points_earned: itemEarn[i],
        seller_escrow_cents: itemSplits[i].seller_escrow_cents,
        platform_escrow_cents: itemPlatform[i] || 0,
      });
    });
  });

  return { orders, items };
}
