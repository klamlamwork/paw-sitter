"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cloudinaryImageUrl } from "@/lib/cloudinary";
import ProductGalleryEditor from "@/components/shop/ProductGalleryEditor";
import LongevityChipsEditor from "@/components/shop/LongevityChipsEditor";

function withPreview(row) {
  return {
    ...row,
    url: row.public_id
      ? cloudinaryImageUrl({ publicId: row.public_id, version: row.version, width: 360, height: 360 })
      : row.url || "",
  };
}

export default function ProductEditMediaLongevity({
  productId,
  persistLive = true,
  onChange,
  initialMedia,
  initialChips,
}) {
  const [media, setMedia] = useState((initialMedia || []).map(withPreview));
  const [chips, setChips] = useState(initialChips || []);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const [{ data: mediaRows }, { data: chipRows }] = await Promise.all([
        supabase.from("shop_product_media").select("id, url, public_id, version, alt_text, sort_order").eq("product_id", productId).order("sort_order"),
        supabase.from("shop_product_longevity_items").select("id, highlight_id, icon_key, label, note, sort_order").eq("product_id", productId).order("sort_order"),
      ]);
      if (cancelled) return;
      const pendingUsable = (initialMedia || []).some((row) => row.public_id || row.url);
      const nextMedia = (pendingUsable ? initialMedia : mediaRows || []).map(withPreview);
      const nextChips = (initialChips && initialChips.length ? initialChips : chipRows) || [];
      setMedia(nextMedia);
      setChips(nextChips);
      onChange?.({ media: nextMedia, chips: nextChips });
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function saveGallery(next) {
    setMedia(next);
    setError("");
    onChange?.({ media: next, chips });
    if (!persistLive) return;
    const supabase = createClient();
    const { error: delErr } = await supabase.from("shop_product_media").delete().eq("product_id", productId);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (next.length) {
      const { error: insErr } = await supabase.from("shop_product_media").insert(
        next.map((m, i) => ({
          product_id: productId,
          public_id: m.public_id || null,
          version: m.version || null,
          url: m.public_id ? null : m.url || null,
          alt_text: m.alt_text || "",
          sort_order: i,
        }))
      );
      if (insErr) setError(insErr.message);
    }
  }

  async function saveChips(next) {
    setChips(next);
    setError("");
    onChange?.({ media, chips: next });
    if (!persistLive) return;
    const supabase = createClient();
    const { error: delErr } = await supabase.from("shop_product_longevity_items").delete().eq("product_id", productId);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (next.length) {
      const { error: insErr } = await supabase.from("shop_product_longevity_items").insert(
        next.map((c, i) => ({
          product_id: productId,
          highlight_id: c.highlight_id || null,
          icon_key: c.icon_key || "heart",
          label: c.label,
          note: c.note || "",
          sort_order: i,
        }))
      );
      if (insErr) setError(insErr.message);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {!persistLive ? (
        <p className="text-xs text-amber-800">Gallery and longevity changes are included in the approval request. The public page keeps the last approved images until admin approves.</p>
      ) : null}
      <ProductGalleryEditor inputId={`edit-gallery-${productId}`} productId={productId} images={media} onChange={saveGallery} />
      <LongevityChipsEditor items={chips} onChange={saveChips} />
    </div>
  );
}
