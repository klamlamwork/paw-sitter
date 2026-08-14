"use client";

import { useEffect, useState } from "react";
import ProductVariantPicker from "@/components/shop/ProductVariantPicker";
import AddToCartButton from "@/components/shop/AddToCartButton";
import QtyStepper from "@/components/shop/QtyStepper";
import { formatShopPrice } from "@/lib/shop";
import { createClient } from "@/lib/supabase/client";

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
  showAffiliate,
  affiliateUrl,
}) {
  const hasVariants = (variants || []).length > 0;
  const priceLabel = formatShopPrice(displayCents, displayCurrency, displayHide);
  const [qty, setQty] = useState(1);
  const [stockQty, setStockQty] = useState(null);
  const [trackStock, setTrackStock] = useState(false);

  useEffect(() => {
    if (hasVariants || !cartLineBase?.product_id) return;
    const supabase = createClient();
    supabase
      .from("shop_products")
      .select("stock_qty, track_stock")
      .eq("id", cartLineBase.product_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStockQty(data.stock_qty);
        setTrackStock(!!data.track_stock);
      });
  }, [hasVariants, cartLineBase?.product_id]);

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
        showAffiliate={!!showAffiliate}
        affiliateUrl={affiliateUrl || ""}
      />
    );
  }

  const outOfStock = trackStock && (stockQty == null || stockQty <= 0);
  const stockMax = trackStock && stockQty != null ? stockQty : 99;

  return (
    <div className="mt-4 space-y-3">
      {priceLabel ? (
        <p className="text-2xl font-bold text-[#c45c26]">{priceLabel}</p>
      ) : (
        <p className="text-sm text-[#7a5c4e]">Price on request / see seller</p>
      )}
      {trackStock ? (
        <p className="text-xs font-semibold text-[#7a5c4e]">
          {outOfStock ? "Out of stock" : `${stockQty} in stock`}
        </p>
      ) : null}
      {showCart && cartLineBase ? (
        <div className="flex flex-wrap items-center gap-4">
          <QtyStepper qty={qty} max={outOfStock ? 1 : stockMax} onChange={setQty} />
          <AddToCartButton
            disabled={!!outOfStock}
            line={{
              ...cartLineBase,
              variant_id: null,
              price_cents: displayCents,
              currency: displayCurrency || "CAD",
              qty,
            }}
          />
        </div>
      ) : null}
      {showAffiliate && affiliateUrl ? (
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex rounded-full border border-[#c45c26] px-6 py-2.5 text-sm font-semibold text-[#c45c26]"
        >
          Buy / view offer
        </a>
      ) : null}
    </div>
  );
}
