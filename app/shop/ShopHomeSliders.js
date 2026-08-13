"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

function ShopChip({ href, name, logoUrl }) {
  return (
    <Link
      href={href}
      className="group flex h-[4.5rem] w-full items-center gap-2.5 overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white px-2.5 shadow-sm transition hover:border-[#c45c26]/45 hover:shadow-md sm:h-20 sm:gap-3 sm:px-3"
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#fff8f0] ring-1 ring-[#e8d5c4] sm:h-12 sm:w-12">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#c45c26]/85">
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-[#3b2a22] group-hover:text-[#c45c26]">
        {name}
      </span>
    </Link>
  );
}

/**
 * Desktop: 4 columns.
 * Mobile: horizontal snap slider, ~2 cards in view.
 */
export default function ShopEntitySlider({ items, emptyLabel }) {
  const scrollerRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const updateChrome = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft + clientWidth < scrollWidth - 4);
    const p = Math.max(1, Math.ceil(scrollWidth / Math.max(clientWidth, 1)));
    setPages(p);
    setPage(Math.min(p - 1, Math.round(scrollLeft / Math.max(clientWidth, 1))));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateChrome();
    el.addEventListener("scroll", updateChrome, { passive: true });
    window.addEventListener("resize", updateChrome);
    return () => {
      el.removeEventListener("scroll", updateChrome);
      window.removeEventListener("resize", updateChrome);
    };
  }, [updateChrome, items]);

  function scrollByDir(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  if (!items?.length) {
    return <p className="mt-3 text-sm text-[#7a5c4e]">{emptyLabel}</p>;
  }

  return (
    <div className="relative mt-3">
      {/* Mobile slider */}
      <div className="sm:hidden">
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((it) => (
              <div
                key={it.id}
                className="w-[calc(50%-0.3125rem)] shrink-0 snap-start"
              >
                <ShopChip href={it.href} name={it.name} logoUrl={it.logoUrl} />
              </div>
            ))}
          </div>

          {canPrev ? (
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scrollByDir(-1)}
              className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e8d5c4] bg-white/95 text-[#3b2a22] shadow-md backdrop-blur"
            >
              ‹
            </button>
          ) : null}
          {canNext ? (
            <button
              type="button"
              aria-label="Next"
              onClick={() => scrollByDir(1)}
              className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#e8d5c4] bg-white/95 text-[#3b2a22] shadow-md backdrop-blur"
            >
              ›
            </button>
          ) : null}
        </div>

        {pages > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === page ? "w-4 bg-[#c45c26]" : "w-1.5 bg-[#e8d5c4]")
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop: 4 per row */}
      <ul className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.id} className="min-w-0">
            <ShopChip href={it.href} name={it.name} logoUrl={it.logoUrl} />
          </li>
        ))}
      </ul>
    </div>
  );
}
