"use client";

import ProductTypeSelect from "@/components/shop/ProductTypeSelect";

/** Shared type + mode fields for create and edit forms */
export default function ShopPortalTypeFields({ productType, inventoryMode, onChange }) {
  return (
    <ProductTypeSelect
      productType={productType || "other"}
      inventoryMode={inventoryMode || "simple"}
      onChange={onChange}
    />
  );
}
