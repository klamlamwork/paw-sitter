"use client";

import { defaultInventoryMode } from "@/lib/shopInventory";

/** Helpers to merge product type into portal form state */
export function withDefaultType(form) {
  return {
    product_type: form.product_type || "other",
    inventory_mode: form.inventory_mode || defaultInventoryMode(form.product_type || "other"),
    ...form,
  };
}

export function applyTypeChange(form, { product_type, inventory_mode }) {
  return {
    ...form,
    product_type,
    inventory_mode,
  };
}
