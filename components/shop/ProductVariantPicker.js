"use client";

import { useMemo, useState } from "react";
import { formatShopPrice } from "@/lib/shop";

export default function ProductVariantPicker({
  variants = [],
  basePriceCents,
  currency = "CAD",
  hidePrice = false,
}) {
  const active = useMemo(
    () => (variants || []).filter((v) => v.is_active),
    [variants]
  );
  const [selectedId, setSelectedId] = useState(active[0]?.id || "");

  if (!active.length) return null;

  const selected = active.find((v) => v.id === selectedId) || active[0];
  const cents =
    selected?.price_cents != null ? selected.price_cents : basePriceCents;
  const priceLabel = formatShopPrice(cents, currency, hidePrice);
  const outOfStock =
    selected?.track_stock && (selected.stock_qty == null || selected.stock_qty <= 0);

  return (
    <div className="mt-5 space-y-2">
      <h2 className="text-sm font-semibold text-[#3b2a22]">Choose variety</h2>
      <div className="flex flex-wrap gap-2">
        {active.map((v) => {
          const on = v.id === selected.id;
          const oos = v.track_stock && (v.stock_qty == null || v.stock_qty <= 0);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                (on
                  ? "bg-[#c45c26] text-white"
                  : "border border-[#e8d5c4] bg-white text-[#5c4033] hover:border-[#c45c26]/50") +
                (oos ? " opacity-60" : "")
              }
            >
              {v.name}
              {oos ? " · sold out" : ""}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        {priceLabel ? (
          <p className="text-2xl font-bold text-[#c45c26]">{priceLabel}</p>
        ) : null}
        {selected?.track_stock ? (
          <p className="text-xs text-[#7a5c4e]">
            {outOfStock
              ? "Out of stock"
              : `${selected.stock_qty} in stock`}
          </p>
        ) : (
          <p className="text-xs text-[#7a5c4e]">In stock</p>
        )}
      </div>
    </div>
  );
}
