import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath } from "@/lib/shop";
import { enrichProducts, sortCategoriesForFilters } from "@/lib/shopCatalog";
import ShopProductsPanel from "../../ShopProductsPanel";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_shops")
    .select("name, seo_title, seo_description, description")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { title: "Shop | Paw Sitter" };
  return {
    title: data.seo_title || `${data.name} | Paw Sitter Shop`,
    description: data.seo_description || data.description || undefined,
  };
}

export default async function ShopShopDetailPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shop_shops")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!shop) notFound();

  // Products via offers + primary_shop + brand_shop
  const { data: offerRows } = await supabase
    .from("shop_product_offers")
    .select("product_id")
    .eq("shop_id", shop.id)
    .eq("status", "approved");

  const offerIds = [...new Set((offerRows || []).map((o) => o.product_id))];

  let productQuery = supabase
    .from("shop_products")
    .select(
      "id, name, slug, short_description, price_cents, currency, hide_price, brand_shop_id, primary_shop_id, category_id, updated_at, status"
    )
    .eq("status", "approved");

  // Fetch candidates then filter in JS for OR conditions
  const { data: allApproved } = await productQuery.order("updated_at", { ascending: false }).limit(500);

  const productsRaw = (allApproved || []).filter(
    (p) =>
      offerIds.includes(p.id) ||
      p.primary_shop_id === shop.id ||
      (shop.is_product_brand && p.brand_shop_id === shop.id)
  );

  const { products, coverByProduct, longevityLabels } = await enrichProducts(supabase, productsRaw);
  const { data: categories } = await supabase
    .from("shop_categories")
    .select("id, name, slug, sort_order, filter_row, parent_id")
    .order("sort_order");
  const { categoriesRow1, categoriesRow2 } = sortCategoriesForFilters(categories);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/shops" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; All shops
      </Link>
      <div className="mt-6 flex flex-wrap items-start gap-4">
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-[#e8d5c4]" />
        ) : null}
        <div>
          {shop.is_product_brand ? (
            <p className="text-xs font-bold uppercase tracking-wide text-[#c45c26]">Product brand</p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">Retailer</p>
          )}
          <h1 className="text-3xl font-bold text-[#3b2a22]">{shop.name}</h1>
          {shop.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[#5c4033]">{shop.description}</p>
          ) : null}
          {shop.is_product_brand ? (
            <p className="mt-2 text-sm">
              <Link href={brandShopPath(shop)} className="font-semibold text-[#c45c26] hover:underline">
                Brand hub →
              </Link>
            </p>
          ) : null}
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
