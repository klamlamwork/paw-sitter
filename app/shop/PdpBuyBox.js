"use client";

import ProductVariantPicker from "@/components/shop/ProductVariantPicker";
import AddToCartButton from "@/components/shop/AddToCartButton";
import { formatShopPrice } from "@/lib/shop";

export default function PdpBuyBox({
  variants,
  displayCents,
  displayCurrency,
  displayHide,
  batchMode,
  discountDays,
  discountPct,
  showCart,
  cartLineBase,
}) {
  const hasVariants = (variants || []).length > 0;
  const priceLabel = formatShopPrice(displayCents, displayCurrency, displayHide);

  if (hasVariants) {
    return (
      <ProductVariantPicker
        variants={variants}
        basePriceCents={displayCents}
        currency={displayCurrency}
        hidePrice={displayHide}
        showFefo={batchMode}
        discountDays={discountDays}
        discountPct={discountPct}
        showAddToCart={!!showCart}
        cartLineBase={cartLineBase}
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {priceLabel ? (
        <p className="text-2xl font-bold text-[#c45c26]">{priceLabel}</p>
      ) : (
        <p className="text-sm text-[#7a5c4e]">Price on request / see seller</p>
      )}
      {showCart && cartLineBase ? (
        <AddToCartButton
          line={{
            ...cartLineBase,
            variant_id: null,
            price_cents: displayCents,
            currency: displayCurrency || "CAD",
            qty: 1,
          }}
        />
      ) : null}
    </div>
  );
}
