import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatShopPrice, productPath } from "@/lib/shop";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_shops").select("name, seo_title, seo_description, description, status").eq("slug", slug).maybeSingle();
  return {
    title: data?.seo_title || `${data?.name || "Shop"} | Shops | Paw Sitter`,
    description: data?.seo_description || data?.description || "Shop storefront on Paw Sitter.",
  };
}

/** Vendor / brand operator storefront — URL: /shop/shops/[slug] */
export default async function ShopStorefrontPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shop_shops")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!shop) notFound();

  const { data: links } = await supabase.from("shop_product_shops").select("product_id").eq("shop_id", shop.id);
  const ids = (links || []).map((l) => l.product_id);
  let products = [];
  if (ids.length) {
    const { data } = await supabase
      .from("shop_products")
      .select("id, name, slug, short_description, price_cents, currency, hide_price, shop_product_media(url, sort_order)")
      .eq("status", "approved")
      .in("id", ids)
      .order("name");
    products = data || [];
  }
  // Also include products where this shop is primary
  const { data: primary } = await supabase
    .from("shop_products")
    .select("id, name, slug, short_description, price_cents, currency, hide_price, shop_product_media(url, sort_order)")
    .eq("status", "approved")
    .eq("primary_shop_id", shop.id)
    .order("name");
  const byId = new Map();
  for (const p of [...(primary || []), ...products]) byId.set(p.id, p);
  products = Array.from(byId.values());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <header className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">{shop.shop_type} shop</p>
        <h1 className="mt-1 text-3xl font-bold text-[#3b2a22]">{shop.name}</h1>
        {shop.description ? <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">{shop.description}</p> : null}
      </header>
      <h2 className="mt-10 text-lg font-bold text-[#3b2a22]">Catalog</h2>
      <p className="mt-1 text-xs text-[#7a5c4e]">Only admin-approved products are listed.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
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
      {!products.length ? <p className="mt-4 text-sm text-[#7a5c4e]">No approved products in this shop yet.</p> : null}
    </div>
  );
}
