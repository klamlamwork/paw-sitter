"use client";

import { useMemo, useState } from "react";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

function resolveUrl(media, size) {
  if (media?.public_id) {
    return cloudinaryImageUrl({
      publicId: media.public_id,
      version: media.version,
      width: size,
      height: size,
    });
  }
  return media?.url || "";
}

export default function ProductGallery({ images = [], productName = "" }) {
  const list = useMemo(
    () => (images || []).map((m) => ({ ...m, deliveryUrl: resolveUrl(m, 1200), thumbUrl: resolveUrl(m, 180) })).filter((m) => m.deliveryUrl),
    [images]
  );
  const [active, setActive] = useState(0);
  const current = list[active] || list[0] || null;

  if (!list.length) {
    return <div className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]"><div className="flex aspect-square items-center justify-center text-sm text-[#7a5c4e]">No image</div></div>;
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]">
        <img src={current.deliveryUrl} alt={current.alt_text || productName} className="aspect-square w-full object-cover" />
      </div>
      {list.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((m, i) => {
            const selected = i === active;
            return (
              <li key={m.id || m.public_id || m.url || i} className="shrink-0">
                <button type="button" onClick={() => setActive(i)} aria-label={`View image ${i + 1}`} aria-current={selected ? "true" : undefined} className={"relative h-16 w-16 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-20 " + (selected ? "border-[#c45c26] ring-2 ring-[#c45c26]/25" : "border-[#e8d5c4] opacity-90 hover:opacity-100")}>
                  <img src={m.thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
