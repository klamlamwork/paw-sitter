"use client";

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
 * Mobile: horizontal scroll; left edge aligns with page content; right card peeks.
 */
export default function ShopEntitySlider({ items, emptyLabel }) {
  if (!items?.length) {
    return <p className="mt-3 text-sm text-[#7a5c4e]">{emptyLabel}</p>;
  }

  return (
    <div className="relative mt-3">
      {/*
        Mobile slider:
        - No negative left margin (aligns with headlines)
        - Bleed only to the right so next card is cut off
      */}
      <div className="sm:hidden">
        <div
          className="-mr-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pr-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              className="w-[calc((100%-0.625rem)/1.65)] shrink-0 snap-start"
            >
              <ShopChip href={it.href} name={it.name} logoUrl={it.logoUrl} />
            </div>
          ))}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
      </div>

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
