import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  brandShopPath,
  formatShopPrice,
  shopPath,
  shopProductPath,
} from "@/lib/shop";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("name, seo_title, seo_description, short_description")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) return { title: "Product | Paw Sitter Shop" };
  return {
    title: data.seo_title || `${data.name} | Paw Sitter Shop`,
    description: data.seo_description || data.short_description || undefined,
  };
}

export default async function ShopProductPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("shop_products")
    .select("*, shop_product_media(*)")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (!product) notFound();

  let brandShop = null;
  if (product.brand_shop_id) {
    const { data } = await supabase
      .from("shop_shops")
      .select("id, name, slug, logo_url, is_product_brand, status")
      .eq("id", product.brand_shop_id)
      .maybeSingle();
    brandShop = data;
  }

  // Offers from other shops / brand DTC (after sql/21)
  let offers = [];
  const { data: offerRows, error: offerErr } = await supabase
    .from("shop_product_offers")
    .select(
      "id, shop_id, price_cents, currency, hide_price, show_affiliate, show_add_to_cart, affiliate_url, is_default, shop:shop_shops(id, name, slug, logo_url, is_product_brand, status)"
    )
    .eq("product_id", product.id)
    .eq("status", "approved");

  if (!offerErr && offerRows) {
    offers = offerRows.filter((o) => o.shop && o.shop.status === "active");
  }

  const media = (product.shop_product_media || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const cover = media[0];

  // Fallback display price from default offer or product columns
  const defaultOffer =
    offers.find((o) => o.is_default) || offers[0] || null;
  const displayCents = defaultOffer?.price_cents ?? product.price_cents;
  const displayCurrency = defaultOffer?.currency || product.currency || "CAD";
  const displayHide = defaultOffer ? defaultOffer.hide_price : product.hide_price;
  const priceLabel = formatShopPrice(displayCents, displayCurrency, displayHide);

  const showAffiliate = defaultOffer
    ? defaultOffer.show_affiliate && defaultOffer.affiliate_url
    : product.show_affiliate && product.affiliate_url;
  const affiliateUrl = defaultOffer?.affiliate_url || product.affiliate_url;
  const showCart = defaultOffer
    ? defaultOffer.show_add_to_cart
    : product.show_add_to_cart;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]">
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={cover.alt_text || product.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-[#7a5c4e]">
              No image
            </div>
          )}
          {media.length > 1 ? (
            <ul className="flex gap-2 overflow-x-auto border-t border-[#e8d5c4] p-2">
              {media.map((m) => (
                <li key={m.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#e8d5c4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          {brandShop ? (
            <Link
              href={brandShopPath(brandShop)}
              className="text-xs font-bold uppercase tracking-wide text-[#c45c26] hover:underline"
            >
              {brandShop.name}
            </Link>
          ) : null}
          <h1 className="mt-1 text-3xl font-bold text-[#3b2a22]">{product.name}</h1>
          {product.short_description ? (
            <p className="mt-2 text-sm text-[#5c4033]">{product.short_description}</p>
          ) : null}
          {priceLabel ? (
            <p className="mt-4 text-2xl font-bold text-[#c45c26]">{priceLabel}</p>
          ) : (
            <p className="mt-4 text-sm text-[#7a5c4e]">Price on request / see seller</p>
          )}

          {product.longevity_blurb ? (
            <p className="mt-4 rounded-xl bg-[#fff8f0] px-3 py-2 text-sm text-[#5c4033]">
              {product.longevity_blurb}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {showAffiliate ? (
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white"
              >
                Buy / view offer
              </a>
            ) : null}
            {showCart ? (
              <span className="inline-flex rounded-full border border-[#e8d5c4] px-6 py-2.5 text-sm font-semibold text-[#7a5c4e]">
                Add to cart (coming soon)
              </span>
            ) : null}
          </div>

          {/* Multi-seller logo strip */}
          {offers.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-[#3b2a22]">Available from</h2>
              <p className="mt-1 text-xs text-[#7a5c4e]">
                Choose a shop — opens that retailer&apos;s offer for this product.
              </p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {offers.map((o) => {
                  const s = o.shop;
                  const href = shopProductPath(s, product);
                  const label = formatShopPrice(o.price_cents, o.currency, o.hide_price);
                  return (
                    <li key={o.id}>
                      <Link
                        href={href}
                        className="flex flex-col items-center gap-1 rounded-2xl border border-[#e8d5c4] bg-white px-3 py-2 text-center hover:border-[#c45c26]/50"
                        title={s.name}
                      >
                        {s.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.logo_url}
                            alt={s.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff8f0] text-xs font-bold text-[#c45c26]">
                            {s.name.slice(0, 1)}
                          </span>
                        )}
                        <span className="max-w-[5.5rem] truncate text-[10px] font-semibold text-[#3b2a22]">
                          {s.name}
                        </span>
                        {label ? (
                          <span className="text-[10px] text-[#c45c26]">{label}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {brandShop ? (
            <p className="mt-6 text-xs text-[#7a5c4e]">
              Brand page:{" "}
              <Link href={brandShopPath(brandShop)} className="font-semibold text-[#c45c26] hover:underline">
                {brandShop.name}
              </Link>
              {" · "}
              <Link href={shopPath(brandShop)} className="font-semibold text-[#c45c26] hover:underline">
                Brand shop storefront
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      {product.description ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-semibold text-[#3b2a22]">About</h2>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5c4033]">
            {product.description}
          </div>
        </section>
      ) : null}
    </div>
  );
}
