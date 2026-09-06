"use client";

import { useState } from "react";

export default function ReviewSlideshow({ items = [] }) {
  const slides = items.filter((row) => row?.url);
  const [index, setIndex] = useState(0);
  if (!slides.length) return null;
  const slide = slides[Math.min(index, slides.length - 1)];
  return (
    <div className="mt-3">
      {slide.resource_type === "video" ? <video key={slide.id} controls className="w-full rounded-2xl bg-black" src={slide.url} /> : <img key={slide.id} src={slide.url} alt={slide.caption || ""} className="w-full rounded-2xl object-cover" />}
      {slide.caption ? <p className="mt-2 text-sm text-[#5c4033]">{slide.caption}</p> : null}
      {slides.length > 1 ? (
        <div className="mt-2 flex items-center justify-between text-xs">
          <button type="button" className="font-semibold text-[#c45c26]" onClick={() => setIndex((i) => (i === 0 ? slides.length - 1 : i - 1))}>Prev</button>
          <span>{index + 1} / {slides.length}</span>
          <button type="button" className="font-semibold text-[#c45c26]" onClick={() => setIndex((i) => (i + 1) % slides.length)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
