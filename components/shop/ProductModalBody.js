"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatShopPrice } from "@/lib/shop";
import ProductGallery from "@/components/shop/ProductGallery";
import LongevityHighlightGrid from "@/components/shop/LongevityHighlightGrid";
import EligibleRetailers from "@/components/shop/EligibleRetailers";
import PdpBuyBox from "@/app/shop/PdpBuyBox";

export default function ProductModalBody({ slug }) {
  const [state, setState] = useState({ loading: true, error: "", product: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ loading: true, error: "", product: null });
      const supabase = createClient();
      const { data: product, error } = await supabase
        .from("shop_products")
        .select("*, shop_product_media(*)")
        .eq("slug", slug)
        .eq("status", "approved")
        .maybeSingle();
      if (cancelled) return;
      if (error || !product) {
        setState({ loading: false, error: error?.message || "Product not found.", product: null });
        return;
      }

      const [{ data: chips }, { data: variants }, { data: offerRows }] = await Promise.all([
        supabase
          .from("shop_product_longevity_items")
          .select("id, highlight_id, icon_key, label, note, sort_order")
          .eq("product_id", product.id)
          .order("sort_order"),
        supabase.from("shop_product_variants").select("*").eq("product_id", product.id).order("sort_order"),
        supabase
          .from("shop_product_offers")
          .select("id, shop_id, product_page_url, status, show_affiliate, show_add_to_cart, affiliate_url, price_cents, currency, hide_price")
          .eq("product_id", product.id),
      ]);

      const shopIds = [...new Set((offerRows || []).map((o) => o.shop_id).filter(Boolean))];
      let shopsById = {};
      if (shopIds.length) {
        const { data: shops } = await supabase
          .from("shop_shops")
          .select("id, name, slug, logo_url, is_product_brand, status")
          .in("id", shopIds);
        shopsById = Object.fromEntries((shops || []).map((s) => [s.id, s]));
      }
      const retailers = (offerRows || [])
        .map((o) => ({ ...o, shop: shopsById[o.shop_id] || null }))
        .filter((o) => o.shop && o.shop.status !== "suspended" && o.shop_id !== product.brand_shop_id && o.shop_id !== product.primary_shop_id);

      if (cancelled) return;
      setState({
        loading: false,
        error: "",
        product: {
          ...product,
          chips: chips || [],
          variants: (variants || []).filter((v) => v.is_active !== false),
          retailers,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.loading) return <p className="py-10 text-center text-sm text-[#7a5c4e]">Loading product…</p>;
  if (state.error || !state.product) {
    return (
      <p className="py-10 text-center text-sm text-red-700">
        {state.error || "Product not found."}{" "}
        <Link href={`/shop/p/${slug}`} data-full-page="1" className="font-semibold text-[#c45c26] underline">
          Open full page
        </Link>
      </p>
    );
  }

  const p = state.product;
  const media = (p.shop_product_media || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const defaultOffer = (p.retailers || []).find((o) => o.is_default) || p.retailers?.[0];
  const displayCents = defaultOffer?.price_cents ?? p.price_cents;
  const displayCurrency = defaultOffer?.currency || p.currency || "CAD";
  const displayHide = defaultOffer ? defaultOffer.hide_price : p.hide_price;
  const showCart = defaultOffer ? defaultOffer.show_add_to_cart : p.show_add_to_cart;
  const priceLabel = formatShopPrice(displayCents, displayCurrency, displayHide);

  return (
    <div className="pb-8">
      {media.length ? <ProductGallery media={media} name={p.name} /> : (
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#fff1e6] text-sm text-[#7a5c4e]">No image</div>
      )}
      <h1 className="mt-4 text-2xl font-bold text-[#3b2a22]">{p.name}</h1>
      {p.short_description ? <p className="mt-2 text-sm text-[#5c4033]">{p.short_description}</p> : null}
      {priceLabel ? <p className="mt-3 text-xl font-bold text-[#c45c26]">{priceLabel}</p> : null}
      <PdpBuyBox
        variants={p.variants || []}
        displayCents={displayCents}
        displayCurrency={displayCurrency}
        displayHide={displayHide}
        showCart={!!showCart}
        cartLineBase={{
          product_id: p.id,
          shop_id: p.primary_shop_id,
          name: p.name,
          slug: p.slug,
          price_cents: displayCents,
          currency: displayCurrency,
        }}
      />
      <LongevityHighlightGrid items={p.chips || []} />
      <EligibleRetailers retailers={p.retailers || []} />
      {p.description ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-[#3b2a22]">About</h2>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5c4033]">{p.description}</div>
        </section>
      ) : null}
      <p className="mt-6 text-center text-xs">
        <Link href={`/shop/p/${p.slug}`} data-full-page="1" className="font-semibold text-[#c45c26] hover:underline">
          Open full product page
        </Link>
      </p>
    </div>
  );
}
