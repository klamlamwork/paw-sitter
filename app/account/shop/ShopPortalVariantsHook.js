"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ProductVariantsEditor from "@/components/shop/ProductVariantsEditor";

export default function ShopPortalVariantsHook({ product }) {
  const shopId = product.primary_shop_id || product.brand_shop_id;
  const [variants, setVariants] = useState(product.variants || []);
  const [mode, setMode] = useState(product.inventory_mode || "simple");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const [{ data: rows }, { data: prod }] = await Promise.all([
        supabase
          .from("shop_product_variants")
          .select("*")
          .eq("product_id", product.id)
          .order("sort_order"),
        supabase.from("shop_products").select("inventory_mode").eq("id", product.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setVariants(rows || []);
      if (prod?.inventory_mode) setMode(prod.inventory_mode);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  if (!product?.id || !shopId) return null;

  return (
    <div className="mt-3">
      <ProductVariantsEditor
        key={`${product.id}-${ready ? "db" : "init"}-${mode}`}
        productId={product.id}
        shopId={shopId}
        initialVariants={variants}
        inventoryMode={mode}
      />
    </div>
  );
}
