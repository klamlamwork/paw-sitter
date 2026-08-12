import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatShopPrice, productPath } from "@/lib/shop";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_brands").select("name, seo_title, seo_description, description").eq("slug", slug).maybeSingle();
  return {
    title: data?.seo_title || `${data?.name || "Brand"} | Shop | Paw Sitter`,
    description: data?.seo_description || data?.description || "Brand products for pet longevity.",
  };
}

export default async function ShopBrandPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: brand } = await supabase.from("shop_brands").select("*").eq("slug", slug).maybeSingle();
  if (!brand) notFound();

  const { data: products } = await supabase
    .from("shop_products")
    .select("id, name, slug, short_description, price_cents, currency, hide_price, shop_product_media(url, sort_order)")
    .eq("status", "approved")
    .eq("brand_id", brand.id)
    .order("name");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/shop/brands" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Brands</Link>
      <header className="mt-4 flex flex-wrap items-start gap-4">
        {brand.logo_url ? <img src={brand.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : null}
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22]">{brand.name}</h1>
          {brand.description ? <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">{brand.description}</p> : null}
        </div>
      </header>
      <h2 className="mt-10 text-lg font-bold text-[#3b2a22]">Products</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products || []).map((p) => {
          const img = (p.shop_product_media || []).sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
          const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
          return (
            <li key={p.id}>
              <Link href={productPath(p.slug)} className="block overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white hover:border-[#c45c26]/40">
                <div className="aspect-[4/3] bg-[#fff1e6]">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}</div>
                <div className="p-4">
                  <p className="font-semibold text-[#3b2a22]">{p.name}</p>
                  {price ? <p className="mt-1 text-sm text-[#c45c26]">{price}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!products?.length ? <p className="mt-4 text-sm text-[#7a5c4e]">No approved products for this brand yet.</p> : null}
    </div>
  );
}
