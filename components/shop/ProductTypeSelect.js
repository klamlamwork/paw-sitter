"use client";

import { PRODUCT_TYPES, defaultInventoryMode } from "@/lib/shopInventory";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ProductTypeSelect({
  productType = "other",
  inventoryMode = "simple",
  onChange,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Product type
        <select
          className={inp}
          value={productType}
          onChange={(e) => {
            const pt = e.target.value;
            onChange({
              product_type: pt,
              inventory_mode: defaultInventoryMode(pt),
            });
          }}
        >
          {PRODUCT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
              {t.inventoryMode === "batch_expiry" ? " (batch + expiry)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Inventory mode
        <select
          className={inp}
          value={inventoryMode}
          onChange={(e) =>
            onChange({
              product_type: productType,
              inventory_mode: e.target.value,
            })
          }
        >
          <option value="simple">Simple stock (no expiry)</option>
          <option value="batch_expiry">Batch + expiry tracking</option>
        </select>
        <span className="mt-0.5 block text-[11px] text-[#7a5c4e]">
          Food / treats / supplements / litter default to batch + expiry. You can override.
        </span>
      </label>
    </div>
  );
}
