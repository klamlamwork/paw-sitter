"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatShopPrice, productPath } from "@/lib/shop";

const PAGE_SIZE = 8;

function ProductCard({ product, coverUrl }) {
  const price = formatShopPrice(product.price_cents, product.currency, product.hide_price);
  return (
    <Link
      href={productPath(product)}
      className="group flex w-full overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white transition hover:border-[#c45c26]/50 sm:flex-col"
    >
      <div className="relative h-28 w-28 shrink-0 bg-[#fff8f0] sm:aspect-square sm:h-auto sm:w-full">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
          <span className="mt-1 line-clamp-2 text-xs text-[#7a5c4e]">{product.short_description}</span>
        ) : null}
        {price ? <span className="mt-1.5 text-sm font-semibold text-[#c45c26]">{price}</span> : null}
      </div>
    </Link>
  );
}

function ToggleChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition " +
        (active
          ? "bg-[#c45c26] text-white"
          : "border border-[#e8d5c4] bg-white text-[#5c4033] hover:border-[#c45c26]/50")
      }
    >
      {children}
    </button>
  );
}

function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function ShopProductsPanel({
  products,
  coverByProduct,
  categoriesRow1,
  categoriesRow2,
  longevityLabels,
}) {
  const [selectedCats, setSelectedCats] = useState(() => new Set());
  const [selectedLon, setSelectedLon] = useState(() => new Set());
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = [...(products || [])];

    if (selectedCats.size > 0) {
      list = list.filter((p) => {
        const ids = p.category_ids || (p.category_id ? [p.category_id] : []);
        return ids.some((id) => selectedCats.has(id));
      });
    }

    if (selectedLon.size > 0) {
      list = list.filter((p) => (p.longevity_labels || []).some((l) => selectedLon.has(l)));
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
  }, [products, selectedCats, selectedLon, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function setCats(next) {
    setSelectedCats(next);
    setPage(1);
  }
  function setLon(next) {
    setSelectedLon(next);
    setPage(1);
  }

  return (
    <div className="mt-4 space-y-4">
      {(categoriesRow1 || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">Categories</p>
          <div className="flex flex-wrap gap-2">
            <ToggleChip active={selectedCats.size === 0} onClick={() => setCats(new Set())}>All</ToggleChip>
            {categoriesRow1.map((c) => (
              <ToggleChip key={c.id} active={selectedCats.has(c.id)} onClick={() => setCats(toggleInSet(selectedCats, c.id))}>
                {c.name}
              </ToggleChip>
            ))}
          </div>
        </div>
      ) : null}

      {(categoriesRow2 || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">More categories</p>
          <div className="flex flex-wrap gap-2">
            {categoriesRow2.map((c) => (
              <ToggleChip key={c.id} active={selectedCats.has(c.id)} onClick={() => setCats(toggleInSet(selectedCats, c.id))}>
                {c.name}
              </ToggleChip>
            ))}
          </div>
        </div>
      ) : null}

      {(longevityLabels || []).length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5c4e]">Longevity blurb</p>
          <div className="flex flex-wrap gap-2">
            <ToggleChip active={selectedLon.size === 0} onClick={() => setLon(new Set())}>All</ToggleChip>
            {longevityLabels.map((label) => (
              <ToggleChip key={label} active={selectedLon.has(label)} onClick={() => setLon(toggleInSet(selectedLon, label))}>
                {label}
              </ToggleChip>
            ))}
          </div>
        </div>
      ) : null}

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
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

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

      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Pagination">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-40">Previous</button>
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            return (
              <button key={n} type="button" onClick={() => setPage(n)} className={"flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold " + (n === safePage ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] text-[#5c4033]")}>
                {n}
              </button>
            );
          })}
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-40">Next</button>
        </nav>
      ) : null}
    </div>
  );
}
