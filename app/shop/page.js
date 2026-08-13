import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandShopPath, formatShopPrice, productPath, shopPath } from "@/lib/shop";

export const metadata = {
  title: "Shop | Paw Sitter",
  description: "Longevity-minded products for pets — brands and retailers on Paw Sitter.",
};

/** Compact row: logo left, name right — ~3/5 of previous square tile height */
function ShopRowTile({ href, name, logoUrl }) {
  return (
    <Link
      href={href}
      className="group flex h-14 items-center gap-3 overflow-hidden rounded-xl border border-[#e8d5c4] bg-white px-2.5 transition hover:border-[#c45c26]/50 sm:h-16"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#fff8f0] ring-1 ring-[#e8d5c4] sm:h-11 sm:w-11">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#c45c26]/80">
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#3b2a22] group-hover:text-[#c45c26]">
        {name}
      </span>
    </Link>
  );
}

function ProductTile({ product, coverUrl }) {
  const price = formatShopPrice(product.price_cents, product.currency, product.hide_price);
  return (
    <Link
      href={productPath(product)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white transition hover:border-[#c45c26]/50"
    >
      <div className="relative aspect-square w-full bg-[#fff8f0]">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#7a5c4e]">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-3 py-3">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-[#3b2a22] group-hover:text-[#c45c26]">
          {product.name}
        </span>
        {product.short_description ? (
          <span className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">
            {product.short_description}
          </span>
        ) : null}
        {price ? (
          <span className="mt-2 text-sm font-semibold text-[#c45c26]">{price}</span>
        ) : null}
      </div>
    </Link>
  );
}

function sortHomeList(rows, sortKey) {
  return [...(rows || [])].sort((a, b) => {
    const sa = a[sortKey];
    const sb = b[sortKey];
    const aHas = sa != null && sa !== "";
    const bHas = sb != null && sb !== "";
    if (aHas && bHas) return Number(sa) - Number(sb) || a.name.localeCompare(b.name);
    if (aHas) return -1;
    if (bHas) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default async function ShopHomePage() {
  const supabase = await createClient();
  const [{ data: brandShopsRaw }, { data: shopsRaw }, { data: products }, { data: categories }] =
    await Promise.all([
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand, home_brand_sort")
        .eq("is_product_brand", true)
        .eq("status", "active"),
      supabase
        .from("shop_shops")
        .select("id, name, slug, logo_url, is_product_brand, home_retailer_sort")
        .eq("status", "active")
        .eq("is_product_brand", false),
      supabase
        .from("shop_products")
        .select(
          "id, name, slug, short_description, price_cents, currency, hide_price, brand_shop_id"
        )
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(24),
      supabase.from("shop_categories").select("id, name, slug").order("sort_order").limit(12),
    ]);

  const brandShops = sortHomeList(brandShopsRaw, "home_brand_sort").slice(0, 10);
  const shops = sortHomeList(shopsRaw, "home_retailer_sort").slice(0, 10);

  const productIds = (products || []).map((p) => p.id);
  const coverByProduct = {};
  if (productIds.length) {
    const { data: media } = await supabase
      .from("shop_product_media")
      .select("product_id, url, sort_order")
      .in("product_id", productIds)
      .order("sort_order", { ascending: true });
    for (const m of media || []) {
      if (!coverByProduct[m.product_id]) coverByProduct[m.product_id] = m.url;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22] sm:text-4xl">Shop</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">
        Product brands and retailers in one place. Open a product, then choose a seller when offers
        are available.
      </p>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Shop by brand</h2>
          <Link href="/shop/brands" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All brands →
          </Link>
        </div>
        {brandShops.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {brandShops.map((b) => (
              <li key={b.id} className="min-w-0">
                <ShopRowTile href={brandShopPath(b)} name={b.name} logoUrl={b.logo_url} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#7a5c4e]">No product brands yet.</p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Retailers</h2>
          <Link href="/shop/shops" className="text-xs font-semibold text-[#c45c26] hover:underline">
            All shops →
          </Link>
        </div>
        {shops.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shops.map((s) => (
              <li key={s.id} className="min-w-0">
                <ShopRowTile href={shopPath(s)} name={s.name} logoUrl={s.logo_url} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#7a5c4e]">No retailer shops yet.</p>
        )}
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
        {(products || []).length ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id} className="min-w-0">
                <ProductTile product={p} coverUrl={coverByProduct[p.id] || null} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#7a5c4e]">No products yet.</p>
        )}
      </section>
    </div>
  );
}
