import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { shopPath } from "@/lib/shop";
import { enrichProducts, sortCategoriesForFilters } from "@/lib/shopCatalog";
import ShopProductsPanel from "../../ShopProductsPanel";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_shops")
    .select("name, seo_title, seo_description, description")
    .eq("slug", slug)
    .eq("is_product_brand", true)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { title: "Brand | Paw Sitter Shop" };
  return {
    title: data.seo_title || `${data.name} | Paw Sitter Shop`,
    description: data.seo_description || data.description || undefined,
  };
}

export default async function ShopBrandDetailPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from("shop_shops")
    .select("*")
    .eq("slug", slug)
    .eq("is_product_brand", true)
    .eq("status", "active")
    .maybeSingle();
  if (!brand) notFound();

  const { data: productsRaw } = await supabase
    .from("shop_products")
    .select(
      "id, name, slug, short_description, price_cents, currency, hide_price, brand_shop_id, primary_shop_id, category_id, updated_at, status"
    )
    .eq("brand_shop_id", brand.id)
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  const { products, coverByProduct, longevityLabels } = await enrichProducts(
    supabase,
    productsRaw || []
  );
  const { data: categories } = await supabase
    .from("shop_categories")
    .select("id, name, slug, sort_order, filter_row, parent_id")
    .order("sort_order");
  const { categoriesRow1, categoriesRow2 } = sortCategoriesForFilters(categories);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/brands" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; All brands
      </Link>
      <div className="mt-6 flex flex-wrap items-start gap-4">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-[#e8d5c4]" />
        ) : null}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#c45c26]">Product brand</p>
          <h1 className="text-3xl font-bold text-[#3b2a22]">{brand.name}</h1>
          {brand.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[#5c4033]">{brand.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-[#7a5c4e]">
            Storefront:{" "}
            <Link href={shopPath(brand)} className="font-semibold text-[#c45c26] hover:underline">
              {shopPath(brand)}
            </Link>
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Products</h2>
        <ShopProductsPanel
          products={products}
          coverByProduct={coverByProduct}
          categoriesRow1={categoriesRow1}
          categoriesRow2={categoriesRow2}
          longevityLabels={longevityLabels}
        />
      </section>
    </div>
  );
}
