"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProductVariantsEditor from "@/components/shop/ProductVariantsEditor";

export default function ShopPortalVariantsHook({ product }) {
  const shopId = product?.primary_shop_id || product?.brand_shop_id;
  const [variants, setVariants] = useState(product?.variants || []);
  const [inventoryMode, setInventoryMode] = useState(product?.inventory_mode || "simple");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const supabase = createClient();
    async function load() {
      const [{ data: variantRows }, { data: currentProduct }] = await Promise.all([
        supabase.from("shop_product_variants").select("*").eq("product_id", product.id).order("sort_order"),
        supabase.from("shop_products").select("inventory_mode").eq("id", product.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setVariants(variantRows || []);
      setInventoryMode(currentProduct?.inventory_mode || product.inventory_mode || "simple");
      setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, [product?.id, product?.inventory_mode]);

  if (!product?.id || !shopId) return null;

  return (
    <div className="mt-3 border-t border-[#e8d5c4] pt-3">
      <ProductVariantsEditor
        key={`${product.id}-${inventoryMode}-${loaded ? "loaded" : "initial"}`}
        productId={product.id}
        shopId={shopId}
        initialVariants={variants}
        inventoryMode={inventoryMode}
      />
    </div>
  );
}
