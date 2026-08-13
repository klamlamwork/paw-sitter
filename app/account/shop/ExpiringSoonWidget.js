"use client";

import { daysUntil } from "@/lib/shopInventory";

export default function ExpiringSoonWidget({ items = [] }) {
  if (!items.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#3b2a22]">Expiring soon</h2>
          <p className="text-xs text-[#7a5c4e]">Batches within 14 days, then expired lots. Sorted by days left.</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-amber-800">
          {items.length}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((it) => {
          const days = daysUntil(it.expiry_date);
          const urgent = days != null && days <= 7;
          const expired = days != null && days < 0;
          return (
            <li
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#3b2a22]">{it.product_name}</p>
                <p className="text-[#7a5c4e]">
                  {it.variant_name}
                  {it.lot_code ? ` · lot ${it.lot_code}` : ""}
                  {" · qty "}{it.qty_on_hand}
                </p>
              </div>
              <div className="text-right">
                <p className={"font-bold " + (expired ? "text-red-600" : urgent ? "text-amber-800" : "text-[#c45c26]")}>
                  {expired
                    ? `Expired ${-days}d ago`
                    : days === 0
                      ? "Expires today"
                      : `${days}d left`}
                </p>
                <p className="text-[10px] uppercase text-[#7a5c4e]">{it.expiry_date}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
