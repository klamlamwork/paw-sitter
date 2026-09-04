import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, shopPath } from "@/lib/shop";

export default async function ProductPageLayout({ children, params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("shop_products")
    .select("brand_shop_id")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  let brand = null;
  if (product?.brand_shop_id) {
    const { data } = await supabase
      .from("shop_shops")
      .select("id, name, slug, status, is_product_brand")
      .eq("id", product.brand_shop_id)
      .eq("status", "active")
      .maybeSingle();
    brand = data || null;
  }

  const href = brand?.is_product_brand ? brandShopPath(brand) : brand ? shopPath(brand) : null;

  return (
    <>
      {brand && href ? (
        <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">
            Brand{" "}
            <Link href={href} className="text-[#c45c26] hover:underline">
              {brand.name}
            </Link>
          </p>
        </div>
      ) : null}
      {children}
    </>
  );
}
