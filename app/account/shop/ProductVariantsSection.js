"use client";

import ProductVariantsEditor from "@/components/shop/ProductVariantsEditor";

/** Thin wrapper so portal can pass per-product variants */
export default function ProductVariantsSection({ productId, shopId, variants }) {
  if (!productId || !shopId) return null;
  return (
    <div className="mt-4">
      <ProductVariantsEditor
        productId={productId}
        shopId={shopId}
        initialVariants={variants || []}
      />
    </div>
  );
}
