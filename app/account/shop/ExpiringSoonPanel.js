"use client";

import { useMemo, useState } from "react";

function bucketLabel(days) {
  if (days == null) return "No date";
  if (days < 0) return "Expired";
  if (days <= 7) return "7 days";
  if (days <= 14) return "14 days";
  return "Later";
}

function bucketClass(days) {
  if (days == null) return "bg-[#fff8f0] text-[#7a5c4e]";
  if (days < 0) return "bg-red-100 text-red-800";
  if (days <= 7) return "bg-red-50 text-red-700";
  if (days <= 14) return "bg-amber-50 text-amber-800";
  return "bg-[#fff8f0] text-[#7a5c4e]";
}

export default function ExpiringSoonPanel({ rows = [] }) {
  const [open, setOpen] = useState(true);

  const counts = useMemo(() => {
    const expired = rows.filter((r) => r.days < 0).length;
    const d7 = rows.filter((r) => r.days >= 0 && r.days <= 7).length;
    const d14 = rows.filter((r) => r.days > 7 && r.days <= 14).length;
    return { expired, d7, d14 };
  }, [rows]);

  return (
    <section className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-semibold text-[#3b2a22]">Expiring soon</h2>
          <p className="mt-0.5 text-xs text-[#7a5c4e]">
            {rows.length
              ? `${rows.length} lot${rows.length === 1 ? "" : "s"} within 14 days`
              : "No batches expiring in the next 14 days"}
            {rows.length ? (
              <>
                {" · "}
                <span className="font-semibold text-red-700">{counts.expired} expired</span>
                {" · "}
                <span className="font-semibold text-amber-800">{counts.d7} ≤7d</span>
                {" · "}
                {counts.d14} 8–14d
              </>
            ) : null}
          </p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border border-[#e8d5c4] px-2 py-0.5 text-xs font-semibold text-[#5c4033]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        rows.length ? (
          <ul className="mt-4 divide-y divide-[#f0e4d8]">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#3b2a22]">{r.productName}</p>
                  <p className="text-xs text-[#7a5c4e]">
                    {r.variantName}
                    {r.lotCode ? ` · lot ${r.lotCode}` : ""}
                    {" · qty "}{r.qty}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                      bucketClass(r.days)
                    }
                  >
                    {bucketLabel(r.days)}
                  </span>
                  <span className="text-xs font-semibold text-[#5c4033]">
                    {r.days < 0 ? `Expired ${-r.days}d ago` : `${r.days}d left`}
                  </span>
                  <span className="text-xs text-[#7a5c4e]">{r.expiryDate}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#7a5c4e]">
            Food / treats / supplements / litter lots will appear here when they are within 14 days.
          </p>
        )
      ) : null}
    </section>
  );
}
