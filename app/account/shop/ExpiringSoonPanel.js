import Link from "next/link";
import { daysUntil } from "@/lib/shopInventory";

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
  if (!rows.length) {
    return (
      <section className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Expiring soon</h2>
        <p className="mt-1 text-sm text-[#7a5c4e]">
          No batches expiring in the next 14 days. Food / treats / supplements / litter lots will
          appear here.
        </p>
      </section>
    );
  }

  const expired = rows.filter((r) => r.days < 0).length;
  const d7 = rows.filter((r) => r.days >= 0 && r.days <= 7).length;
  const d14 = rows.filter((r) => r.days > 7 && r.days <= 14).length;

  return (
    <section className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[#3b2a22]">Expiring soon</h2>
          <p className="mt-0.5 text-xs text-[#7a5c4e]">
            Batches within 14 days, soonest first. Stock stays shop-managed (no admin approval).
          </p>
        </div>
        <p className="text-xs text-[#7a5c4e]">
          <span className="font-semibold text-red-700">{expired} expired</span>
          {" · "}
          <span className="font-semibold text-amber-800">{d7} ≤7d</span>
          {" · "}
          <span className="font-semibold">{d14} 8–14d</span>
        </p>
      </div>

      <ul className="mt-4 divide-y divide-[#f0e4d8]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-[#3b2a22]">{r.productName}</p>
              <p className="text-xs text-[#7a5c4e]">
                {r.variantName}
                {r.lotCode ? ` · lot ${r.lotCode}` : ""}
                {" · qty "}{r.qty}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " + bucketClass(r.days)}>
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
    </section>
  );
}

export function buildExpiringRows(batches, variantMap, productMap) {
  const rows = [];
  for (const b of batches || []) {
    const days = daysUntil(b.expiry_date);
    if (days == null) continue;
    if (days > 14) continue;
    const v = variantMap[b.variant_id];
    const p = v ? productMap[v.product_id] : null;
    rows.push({
      id: b.id,
      days,
      expiryDate: b.expiry_date,
      qty: b.qty_on_hand ?? 0,
      lotCode: b.lot_code || "",
      status: b.status,
      variantName: v?.name || "Variety",
      productName: p?.name || "Product",
    });
  }
  rows.sort((a, b) => a.days - b.days || a.productName.localeCompare(b.productName));
  return rows;
}
