import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, formatShopPrice, productPath } from "@/lib/shop";

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

  // Products this shop offers (when offers table exists) + brand-owned products
  let offered = [];
  const { data: offers, error: offersErr } = await supabase
    .from("shop_product_offers")
    .select(
      "id, price_cents, currency, hide_price, product:shop_products(id, name, slug, short_description, status)"
    )
    .eq("shop_id", shop.id)
    .eq("status", "approved");

  if (!offersErr && offers) {
    offered = offers
      .filter((o) => o.product?.status === "approved")
      .map((o) => ({
        id: o.product.id,
        name: o.product.name,
        slug: o.product.slug,
        short_description: o.product.short_description,
        price_cents: o.price_cents,
        currency: o.currency,
        hide_price: o.hide_price,
      }));
  }

  if (shop.is_product_brand) {
    const { data: brandProducts } = await supabase
      .from("shop_products")
      .select("id, name, slug, short_description, price_cents, currency, hide_price")
      .eq("brand_shop_id", shop.id)
      .eq("status", "approved");
    const seen = new Set(offered.map((p) => p.id));
    for (const p of brandProducts || []) {
      if (!seen.has(p.id)) offered.push(p);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/shops" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; All shops
      </Link>
      <div className="mt-6">
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
              Brand hub page →
            </Link>
          </p>
        ) : null}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-[#3b2a22]">Catalog</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {offered.map((p) => {
          const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
          return (
            <li key={p.id}>
              <Link
                href={productPath(p)}
                className="block rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 hover:border-[#c45c26]/50"
              >
                <span className="font-semibold text-[#3b2a22]">{p.name}</span>
                {price ? (
                  <span className="mt-1 block text-sm font-semibold text-[#c45c26]">{price}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {!offered.length ? (
        <p className="mt-4 text-sm text-[#7a5c4e]">No products listed for this shop yet.</p>
      ) : null}
    </div>
  );
}
