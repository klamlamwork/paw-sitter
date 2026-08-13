"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatShopPrice, productPath } from "@/lib/shop";

const PAGE_SIZE = 8;

function buildQuery(base, patch) {
  const sp = new URLSearchParams(base.toString());
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  });
  // reset page when filters/sort change unless page explicitly set
  if (!("page" in patch)) sp.delete("page");
  const q = sp.toString();
  return q ? `?${q}` : "";
}

function ProductCard({ product, coverUrl }) {
  const price = formatShopPrice(product.price_cents, product.currency, product.hide_price);
  return (
    <Link
      href={productPath(product)}
      className="group flex w-full overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white transition hover:border-[#c45c26]/50 sm:flex-col"
    >
      {/* Mobile: image left · details right | Desktop: image top */}
      <div className="relative h-28 w-28 shrink-0 bg-[#fff8f0] sm:aspect-square sm:h-auto sm:w-full">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#7a5c4e]">
            No image
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5 sm:py-3">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-[#3b2a22] group-hover:text-[#c45c26]">
          {product.name}
        </span>
        {product.short_description ? (
          <span className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">
            {product.short_description}
          </span>
        ) : null}
        {price ? (
          <span className="mt-1.5 text-sm font-semibold text-[#c45c26]">{price}</span>
        ) : null}
      </div>
    </Link>
  );
}

function Chip({ active, href, children }) {
  return (
    <Link
      href={href}
      className={
        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition " +
        (active
          ? "bg-[#c45c26] text-white"
          : "border border-[#e8d5c4] bg-white text-[#5c4033] hover:border-[#c45c26]/50")
      }
    >
      {children}
    </Link>
  );
}

export default function ShopProductsPanel({
  products,
  coverByProduct,
  categoriesRow1,
  categoriesRow2,
  longevityLabels,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = searchParams.get("cat") || "";
  const lon = searchParams.get("lon") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);

  const filtered = useMemo(() => {
    let list = [...(products || [])];
    if (cat) list = list.filter((p) => p.category_id === cat);
    if (lon) {
      list = list.filter((p) =>
        (p.longevity_labels || []).some((l) => l.toLowerCase() === lon.toLowerCase())
      );
    }
    if (sort === "price_asc") {
      list.sort((a, b) => {
        const pa = a.hide_price || a.price_cents == null ? Number.POSITIVE_INFINITY : a.price_cents;
        const pb = b.hide_price || b.price_cents == null ? Number.POSITIVE_INFINITY : b.price_cents;
        return pa - pb;
      });
    } else if (sort === "price_desc") {
      list.sort((a, b) => {
        const pa = a.hide_price || a.price_cents == null ? -1 : a.price_cents;
        const pb = b.hide_price || b.price_cents == null ? -1 : b.price_cents;
        return pb - pa;
      });
    } else {
      list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }
    return list;
  }, [products, cat, lon, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function hrefFor(patch) {
    return pathname + buildQuery(searchParams, patch);
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Filter row 1 */}
      {(categoriesRow1 || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">
            Categories
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!cat} href={hrefFor({ cat: "" })}>
              All
            </Chip>
            {categoriesRow1.map((c) => (
              <Chip key={c.id} active={cat === c.id} href={hrefFor({ cat: c.id })}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filter row 2 */}
      {(categoriesRow2 || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">
            More categories
          </p>
          <div className="flex flex-wrap gap-2">
            {categoriesRow2.map((c) => (
              <Chip key={c.id} active={cat === c.id} href={hrefFor({ cat: c.id })}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Longevity filters */}
      {(longevityLabels || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">
            Longevity
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!lon} href={hrefFor({ lon: "" })}>
              All
            </Chip>
            {longevityLabels.map((label) => (
              <Chip key={label} active={lon === label} href={hrefFor({ lon: label })}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#7a5c4e]">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#5c4033]">
          Sort by
          <select
            className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold"
            value={sort}
            onChange={(e) => {
              router.push(hrefFor({ sort: e.target.value, page: "" }));
            }}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      {/* Product grid / list */}
      {slice.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {slice.map((p) => (
            <li key={p.id} className="min-w-0">
              <ProductCard product={p} coverUrl={coverByProduct[p.id] || null} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#7a5c4e]">No products match these filters.</p>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Pagination">
          <Link
            href={hrefFor({ page: String(Math.max(1, safePage - 1)) })}
            className={
              "rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold " +
              (safePage <= 1 ? "pointer-events-none opacity-40" : "hover:border-[#c45c26]/50")
            }
            aria-disabled={safePage <= 1}
          >
            Previous
          </Link>
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            return (
              <Link
                key={n}
                href={hrefFor({ page: String(n) })}
                className={
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold " +
                  (n === safePage
                    ? "bg-[#c45c26] text-white"
                    : "border border-[#e8d5c4] text-[#5c4033] hover:border-[#c45c26]/50")
                }
              >
                {n}
              </Link>
            );
          })}
          <Link
            href={hrefFor({ page: String(Math.min(totalPages, safePage + 1)) })}
            className={
              "rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold " +
              (safePage >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:border-[#c45c26]/50")
            }
            aria-disabled={safePage >= totalPages}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
