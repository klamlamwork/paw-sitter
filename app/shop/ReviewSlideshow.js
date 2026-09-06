"use client";

import { useState } from "react";

export default function ReviewSlideshow({ items = [] }) {
  const slides = items.filter((row) => row?.url);
  const [open, setOpen] = useState(-1);
  if (!slides.length) return null;
  const active = open >= 0 ? slides[open] : null;
  return (
    <>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id || index}
            type="button"
            className="w-[78%] min-w-[78%] shrink-0 snap-center text-left sm:w-72 sm:min-w-72"
            onClick={() => setOpen(index)}
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-black">
              {slide.resource_type === "video" ? (
                <video src={slide.url} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
              ) : (
                <img src={slide.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </span>
            {slide.caption ? <p className="mt-2 line-clamp-5 text-sm text-[#5c4033]">{slide.caption}</p> : null}
          </button>
        ))}
      </div>
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(-1)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {active.resource_type === "video" ? <video src={active.url} controls className="max-h-[400px] w-full rounded-xl bg-black" /> : <img src={active.url} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />}
            {active.caption ? <p className="mt-3 whitespace-pre-wrap text-sm text-[#3b2a22]">{active.caption}</p> : null}
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" className="font-semibold text-[#3b2a22]" onClick={() => setOpen((i) => (i <= 0 ? slides.length - 1 : i - 1))}>Previous</button>
              <button type="button" className="font-semibold text-[#3b2a22]" onClick={() => setOpen(-1)}>Close</button>
              <button type="button" className="font-semibold text-[#3b2a22]" onClick={() => setOpen((i) => (i + 1) % slides.length)}>Next</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
