import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandPath, formatShopPrice, shopStorePath } from "@/lib/shop";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("name, seo_title, seo_description, short_description, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "approved") return { title: "Product | Paw Sitter" };
  return {
    title: data.seo_title || `${data.name} | Shop | Paw Sitter`,
    description: data.seo_description || data.short_description || data.name,
  };
}

export default async function ShopProductPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("shop_products")
    .select(
      `*,
      shop_brands ( id, name, slug ),
      shop_shops ( id, name, slug ),
      shop_categories ( id, name, slug ),
      shop_product_media ( id, url, alt_text, sort_order )
    `
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!product) notFound();

  const media = (product.shop_product_media || []).sort((a, b) => a.sort_order - b.sort_order);
  const price = formatShopPrice(product.price_cents, product.currency, product.hide_price);
  const brand = product.shop_brands;
  const shop = product.shop_shops;

  const { data: reviews } = await supabase
    .from("shop_reviews")
    .select("id, rating, title, body, created_at")
    .eq("product_id", product.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  const avg =
    reviews?.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="text-xs text-[#7a5c4e]" aria-label="Breadcrumb">
        <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">Shop</Link>
        {product.shop_categories ? (
          <>
            {" / "}
            <Link href={`/shop/c/${product.shop_categories.slug}`} className="hover:underline">
              {product.shop_categories.name}
            </Link>
          </>
        ) : null}
        {" / "}
        <span className="text-[#3b2a22]">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl border border-[#e8d5c4] bg-[#fff1e6]">
            {media[0]?.url ? (
              <img src={media[0].url} alt={media[0].alt_text || product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#c4a484]">No image</div>
            )}
          </div>
          {media.length > 1 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {media.slice(1, 6).map((m) => (
                <li key={m.id} className="h-16 w-16 overflow-hidden rounded-xl border border-[#e8d5c4]">
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          {brand ? (
            <Link href={brandPath(brand.slug)} className="text-xs font-bold uppercase tracking-wide text-[#c45c26] hover:underline">
              {brand.name}
            </Link>
          ) : null}
          <h1 className="mt-1 text-3xl font-bold text-[#3b2a22]">{product.name}</h1>
          {avg ? (
            <p className="mt-2 text-sm text-[#7a5c4e]">
              {avg} ★ · {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </p>
          ) : null}
          {price ? <p className="mt-4 text-2xl font-bold text-[#c45c26]">{price}</p> : null}
          {product.short_description ? (
            <p className="mt-4 text-sm leading-relaxed text-[#5c4033]">{product.short_description}</p>
          ) : null}
          {product.longevity_blurb ? (
            <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm text-[#3b2a22]">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">Why for longevity</p>
              <p className="mt-1">{product.longevity_blurb}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {product.show_affiliate && product.affiliate_url ? (
              <a
                href={product.affiliate_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9a4519]"
              >
                View offer
              </a>
            ) : null}
            {product.show_add_to_cart ? (
              <button
                type="button"
                disabled
                className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold text-[#7a5c4e] opacity-60"
                title="Cart ships in Phase 2"
              >
                Add to cart (soon)
              </button>
            ) : null}
          </div>
          {product.show_affiliate ? (
            <p className="mt-2 text-[11px] text-[#7a5c4e]">Affiliate disclosure: we may earn a commission at no extra cost to you.</p>
          ) : null}

          {shop ? (
            <p className="mt-6 text-sm text-[#7a5c4e]">
              Sold via{" "}
              <Link href={shopStorePath(shop.slug)} className="font-semibold text-[#c45c26] hover:underline">
                {shop.name}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {product.description ? (
        <section className="prose mt-12 max-w-3xl">
          <h2 className="text-lg font-bold text-[#3b2a22]">Details</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#3b2a22]">{product.description}</div>
        </section>
      ) : null}

      <section className="mt-12 max-w-3xl">
        <h2 className="text-lg font-bold text-[#3b2a22]">Reviews</h2>
        {!reviews?.length ? (
          <p className="mt-3 text-sm text-[#7a5c4e]">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
                <p className="font-semibold text-[#3b2a22]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} {r.title}</p>
                <p className="mt-1 text-[#5c4033]">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
