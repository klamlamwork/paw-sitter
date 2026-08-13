"use client";

import ProductVariantsEditor from "@/components/shop/ProductVariantsEditor";

export default function ShopPortalVariantsHook({ product }) {
  const shopId = product.primary_shop_id || product.brand_shop_id;
  if (!product?.id || !shopId) return null;
  return (
    <div className="mt-4 border-t border-[#e8d5c4] pt-4">
      <ProductVariantsEditor
        productId={product.id}
        shopId={shopId}
        initialVariants={product.variants || []}
        inventoryMode={product.inventory_mode || "simple"}
      />
    </div>
  );
}
