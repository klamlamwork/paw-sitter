import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  brandShopPath,
  formatShopPrice,
  longevityIconEmoji,
  shopProductPath,
} from "@/lib/shop";
import { isBatchExpiryMode } from "@/lib/shopInventory";
import { sellableQtyWithPolicy } from "@/lib/shopExpiryPolicy";
import ProductGallery from "@/components/shop/ProductGallery";
import ProductVariantPicker from "@/components/shop/ProductVariantPicker";

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
      .select("id, name, slug, logo_url, is_product_brand, status, expiry_hide_days, expiry_discount_days, expiry_discount_pct")
      .eq("id", product.brand_shop_id)
      .maybeSingle();
    brandShop = data;
  }

  let stockShop = null;
  const stockShopId = product.primary_shop_id || product.brand_shop_id;
  if (stockShopId && stockShopId !== product.brand_shop_id) {
    const { data } = await supabase
      .from("shop_shops")
      .select("id, expiry_hide_days, expiry_discount_days, expiry_discount_pct")
      .eq("id", stockShopId)
      .maybeSingle();
    stockShop = data;
  } else if (stockShopId === product.brand_shop_id) {
    stockShop = brandShop;
  }

  const hideDays = stockShop?.expiry_hide_days ?? brandShop?.expiry_hide_days ?? 0;
  const discountDays = stockShop?.expiry_discount_days ?? brandShop?.expiry_discount_days ?? 7;
  const discountPct = stockShop?.expiry_discount_pct ?? brandShop?.expiry_discount_pct ?? 0;

  const [{ data: offerRows }, { data: longevityItems }, { data: variantsRaw }] =
    await Promise.all([
      supabase
        .from("shop_product_offers")
        .select(
          "id, shop_id, price_cents, currency, hide_price, show_affiliate, show_add_to_cart, affiliate_url, product_page_url, is_default, shop:shop_shops(id, name, slug, logo_url, is_product_brand, status)"
        )
        .eq("product_id", product.id)
        .eq("status", "approved"),
      supabase
        .from("shop_product_longevity_items")
        .select("id, icon_key, label, note, sort_order")
        .eq("product_id", product.id)
        .order("sort_order"),
      supabase
        .from("shop_product_variants")
        .select("*")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  let variants = variantsRaw || [];
  const batchMode = isBatchExpiryMode(product.inventory_mode);

  if (batchMode && variants.length) {
    const variantIds = variants.map((v) => v.id);
    const { data: batches } = await supabase
      .from("shop_product_batches")
      .select("id, variant_id, qty_on_hand, qty_reserved, expiry_date, status")
      .in("variant_id", variantIds);

    const byVariant = {};
    for (const b of batches || []) {
      if (!byVariant[b.variant_id]) byVariant[b.variant_id] = [];
      byVariant[b.variant_id].push(b);
    }

    variants = variants
      .map((v) => {
        const qty = sellableQtyWithPolicy(byVariant[v.id] || [], hideDays);
        return {
          ...v,
          stock_qty: qty,
          track_stock: true,
          hidden: qty <= 0,
        };
      })
      .filter((v) => !v.hidden);
  }

  const offers = (offerRows || []).filter((o) => o.shop && o.shop.status === "active");
  const eligibleRetailers = offers.filter(
    (o) => o.shop && !o.shop.is_product_brand && (o.product_page_url || "").trim()
  );

  const media = (product.shop_product_media || [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const defaultOffer = offers.find((o) => o.is_default) || offers[0] || null;
  const displayCents = defaultOffer?.price_cents ?? product.price_cents;
  const displayCurrency = defaultOffer?.currency || product.currency || "CAD";
  const displayHide = defaultOffer ? defaultOffer.hide_price : product.hide_price;
  const priceLabel = formatShopPrice(displayCents, displayCurrency, displayHide);
  const hasVariants = variants.length > 0;

  const showAffiliate = defaultOffer
    ? defaultOffer.show_affiliate && defaultOffer.affiliate_url
    : product.show_affiliate && product.affiliate_url;
  const affiliateUrl = defaultOffer?.affiliate_url || product.affiliate_url;
  const showCart = defaultOffer
    ? defaultOffer.show_add_to_cart
    : product.show_add_to_cart;

  const chips = longevityItems || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Shop
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={media} productName={product.name} />

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

          {hasVariants ? (
            <ProductVariantPicker
              variants={variants}
              basePriceCents={displayCents}
              currency={displayCurrency}
              hidePrice={displayHide}
              showFefo={batchMode}
              discountDays={discountDays}
              discountPct={discountPct}
            />
          ) : priceLabel ? (
            <p className="mt-4 text-2xl font-bold text-[#c45c26]">{priceLabel}</p>
          ) : (
            <p className="mt-4 text-sm text-[#7a5c4e]">Price on request / see seller</p>
          )}

          {chips.length ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-[#3b2a22]">Longevity highlights</h2>
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {chips.map((it) => (
                  <li
                    key={it.id}
                    className="flex flex-col items-center rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 px-2 py-3 text-center"
                    title={it.note || it.label}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-[#e8d5c4]">
                      {longevityIconEmoji(it.icon_key)}
                    </span>
                    <span className="mt-2 text-xs font-semibold leading-snug text-[#3b2a22]">
                      {it.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {eligibleRetailers.length ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-[#3b2a22]">Eligible retailers</h2>
              <ul className="mt-3 flex flex-wrap gap-3">
                {eligibleRetailers.map((o) => {
                  const s = o.shop;
                  const href = (o.product_page_url || "").trim() || shopProductPath(s, product);
                  const external = /^https?:\/\//i.test(href);
                  const inner = (
                    <>
                      {s.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.logo_url}
                          alt={s.name}
                          className="h-12 w-12 rounded-full object-cover ring-1 ring-[#e8d5c4]"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff8f0] text-sm font-bold text-[#c45c26] ring-1 ring-[#e8d5c4]">
                          {s.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="max-w-[4.5rem] truncate text-center text-[10px] font-semibold text-[#3b2a22]">
                        {s.name}
                      </span>
                    </>
                  );
                  return (
                    <li key={o.id}>
                      {external ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5" title={s.name}>
                          {inner}
                        </a>
                      ) : (
                        <Link href={href} className="flex flex-col items-center gap-1.5" title={s.name}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
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
