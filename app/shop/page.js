import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, formatShopPrice, productPath, shopPath } from "@/lib/shop";

export const metadata = {
  title: "Shop | Paw Sitter",
  description: "Longevity-minded products for pets — brands and retailers on Paw Sitter.",
};

export default async function ShopHomePage() {
  const supabase = await createClient();
  const [{ data: brandShops }, { data: shops }, { data: products }, { data: categories }] =
    await Promise.all([
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand")
        .eq("is_product_brand", true)
        .eq("status", "active")
        .order("name")
        .limit(12),
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand")
        .eq("status", "active")
        .eq("is_product_brand", false)
        .order("name")
        .limit(8),
      supabase
        .from("shop_products")
        .select("id, name, slug, short_description, price_cents, currency, hide_price, brand_shop_id")
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase.from("shop_categories").select("id, name, slug").order("sort_order").limit(12),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22] sm:text-4xl">Shop</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">
        Product brands and retailers in one place. Open a brand product page, then choose an
        available retailer by logo when you are ready to buy.
      </p>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Shop by brand</h2>
          <Link href="/shop/brands" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All brands →
          </Link>
        </div>
        <ul className="mt-4 flex flex-wrap gap-3">
          {(brandShops || []).map((b) => (
            <li key={b.id}>
              <Link
                href={brandShopPath(b)}
                className="inline-flex items-center gap-2 rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#3b2a22] hover:border-[#c45c26]/50"
              >
                {b.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : null}
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
        {!(brandShops || []).length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No product brands yet.</p>
        ) : null}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Retailers</h2>
          <Link href="/shop/shops" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All shops →
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(shops || []).map((s) => (
            <li key={s.id}>
              <Link
                href={shopPath(s)}
                className="block rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm font-semibold text-[#3b2a22] hover:border-[#c45c26]/50"
              >
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
        {!(shops || []).length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No retailer shops yet.</p>
        ) : null}
      </section>

      {(categories || []).length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Categories</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/shop/c/${c.slug}`}
                  className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold text-[#5c4033] hover:border-[#c45c26]/50"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Products</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(products || []).map((p) => {
            const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
            return (
              <li key={p.id}>
                <Link
                  href={productPath(p)}
                  className="block h-full rounded-2xl border border-[#e8d5c4] bg-white p-4 hover:border-[#c45c26]/50"
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
          <p className="mt-3 text-sm text-[#7a5c4e]">No products yet — coming in the next admin batches.</p>
        ) : null}
      </section>
    </div>
  );
}
