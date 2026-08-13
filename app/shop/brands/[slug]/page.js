import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatShopPrice, productPath, shopPath } from "@/lib/shop";

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

  const { data: products } = await supabase
    .from("shop_products")
    .select("id, name, slug, short_description, price_cents, currency, hide_price, status")
    .eq("brand_shop_id", brand.id)
    .eq("status", "approved")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/brands" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; All brands
      </Link>
      <div className="mt-6 flex flex-wrap items-start gap-4">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-16 w-auto object-contain" />
        ) : null}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#c45c26]">Product brand</p>
          <h1 className="text-3xl font-bold text-[#3b2a22]">{brand.name}</h1>
          {brand.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[#5c4033]">{brand.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-[#7a5c4e]">
            Also a shop storefront:{" "}
            <Link href={shopPath(brand)} className="font-semibold text-[#c45c26] hover:underline">
              {shopPath(brand)}
            </Link>
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-[#3b2a22]">Products</h2>
      <p className="mt-1 text-xs text-[#7a5c4e]">
        Brand product pages. On each product, customers can pick other retailers by logo when
        offers exist.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {(products || []).map((p) => {
          const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
          return (
            <li key={p.id}>
              <Link
                href={productPath(p)}
                className="block rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 hover:border-[#c45c26]/50"
              >
                <span className="font-semibold text-[#3b2a22]">{p.name}</span>
                {p.short_description ? (
                  <span className="mt-1 block text-xs text-[#7a5c4e]">{p.short_description}</span>
                ) : null}
                {price ? (
                  <span className="mt-2 block text-sm font-semibold text-[#c45c26]">{price}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {!(products || []).length ? (
        <p className="mt-4 text-sm text-[#7a5c4e]">No approved products for this brand yet.</p>
      ) : null}
    </div>
  );
}
