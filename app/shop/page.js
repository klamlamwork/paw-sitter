import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandPath, categoryPath, productPath, shopStorePath, formatShopPrice } from "@/lib/shop";

export const metadata = {
  title: "Shop | Longevity picks for dogs & cats | Paw Sitter",
  description:
    "Products reviewed for dog and cat longevity — browse by category, brand, or shop. Find quality that fits your budget.",
};

export default async function ShopHubPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }, { data: products }, { data: shops }] =
    await Promise.all([
      supabase.from("shop_categories").select("id, name, slug, description").order("sort_order").limit(12),
      supabase.from("shop_brands").select("id, name, slug, logo_url, is_featured").eq("is_featured", true).limit(8),
      supabase
        .from("shop_products")
        .select("id, name, slug, short_description, price_cents, currency, hide_price, shop_product_media(url, sort_order)")
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase.from("shop_shops").select("id, name, slug, shop_type").eq("status", "active").limit(8),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold text-[#3b2a22] sm:text-4xl">Shop for longer, healthier lives</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#7a5c4e]">
          We highlight products that support dog and cat longevity — and help you choose options that
          fit your budget. Admin-approved catalog; brands and shops you can trust.
        </p>
      </header>

      <nav className="mt-8 flex flex-wrap gap-2 text-sm" aria-label="Shop sections">
        <Link href="/shop/brands" className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 font-semibold text-[#5c4033] hover:border-[#c45c26]">
          Shop by brand
        </Link>
        <Link href="/shop/c/all" className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 font-semibold text-[#5c4033] hover:border-[#c45c26]">
          Categories
        </Link>
        <Link href="/admin/shop" className="rounded-full border border-dashed border-[#e8d5c4] px-4 py-2 text-xs font-medium text-[#7a5c4e]">
          Admin catalog
        </Link>
      </nav>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-[#3b2a22]">Categories</h2>
        {!categories?.length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No categories yet. Add them in Admin → Shop (Phase 1B).</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={categoryPath(c.slug)}
                  className="block rounded-2xl border border-[#e8d5c4] bg-white p-4 hover:border-[#c45c26]/50"
                >
                  <span className="font-semibold text-[#3b2a22]">{c.name}</span>
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">{c.description}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-[#3b2a22]">Featured brands</h2>
          <Link href="/shop/brands" className="text-sm font-semibold text-[#c45c26] hover:underline">
            All brands
          </Link>
        </div>
        {!brands?.length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No featured brands yet.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-3">
            {brands.map((b) => (
              <li key={b.id}>
                <Link
                  href={brandPath(b.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033] hover:border-[#c45c26]"
                >
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-[#3b2a22]">Shops</h2>
        <p className="mt-1 text-xs text-[#7a5c4e]">Vendor and brand storefronts at /shop/shops/…</p>
        {!shops?.length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No active shops yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {shops.map((s) => (
              <li key={s.id}>
                <Link
                  href={shopStorePath(s.slug)}
                  className="block rounded-2xl border border-[#e8d5c4] bg-white p-4 hover:border-[#c45c26]/50"
                >
                  <span className="font-semibold text-[#3b2a22]">{s.name}</span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-[#7a5c4e]">
                    {s.shop_type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-[#3b2a22]">Latest approved products</h2>
        {!products?.length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No approved products yet. Phase 1B adds admin catalog.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const media = (p.shop_product_media || []).sort((a, b) => a.sort_order - b.sort_order);
              const img = media[0]?.url;
              const price = formatShopPrice(p.price_cents, p.currency, p.hide_price);
              return (
                <li key={p.id}>
                  <Link
                    href={productPath(p.slug)}
                    className="block overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white shadow-sm hover:border-[#c45c26]/40"
                  >
                    <div className="aspect-square bg-[#fff1e6]">
                      {img ? (
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#c4a484]">No image</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-[#3b2a22]">{p.name}</p>
                      {price ? <p className="mt-1 text-xs font-medium text-[#c45c26]">{price}</p> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
