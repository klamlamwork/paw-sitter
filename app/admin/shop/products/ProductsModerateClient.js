"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Inactive" },
  { id: "rejected", label: "Rejected" },
];

export default function ProductsModerateClient({ initialProducts, adminId }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts || []);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const visible = useMemo(() => {
    if (filter === "all") return products;
    if (filter === "archived") return products.filter((p) => p.status === "archived");
    return products.filter((p) => p.status === filter);
  }, [products, filter]);

  async function setStatus(p, status) {
    setBusyId(p.id);
    setError("");
    const supabase = createClient();
    const patch = {
      status,
      updated_at: new Date().toISOString(),
      approved_at: status === "approved" ? new Date().toISOString() : p.approved_at || null,
      approved_by: status === "approved" ? adminId : p.approved_by || null,
    };
    const { error: err } = await supabase.from("shop_products").update(patch).eq("id", p.id);
    setBusyId("");
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, status } : x)));
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              "rounded-full px-3 py-1 text-xs font-semibold " +
              (filter === f.id
                ? "bg-[#c45c26] text-white"
                : "border border-[#e8d5c4] text-[#5c4033]")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visible.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#3b2a22]">{p.name}</p>
                <p className="text-xs text-[#7a5c4e]">
                  /shop/p/{p.slug}
                  {p.brand_shop?.name ? ` · brand: ${p.brand_shop.name}` : ""}
                  {p.category?.name ? ` · ${p.category.name}` : ""}
                </p>
                {p.creator?.email ? (
                  <p className="mt-0.5 text-[11px] text-[#7a5c4e]">
                    Submitted by {p.creator.full_name || p.creator.email}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-[#7a5c4e]">No creator on record</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                  {p.status}
                </span>
                {p.status === "pending" || p.status === "draft" ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "approved")}
                    className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                ) : null}
                {p.status === "pending" ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "rejected")}
                    className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60"
                  >
                    Reject
                  </button>
                ) : null}
                {p.status === "approved" ? (
                  <>
                    <Link
                      href={`/shop/p/${p.slug}`}
                      className="text-xs font-semibold text-[#c45c26]"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => setStatus(p, "archived")}
                      className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    >
                      Inactive
                    </button>
                  </>
                ) : null}
                {p.status === "archived" || p.status === "rejected" ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "pending")}
                    className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60"
                  >
                    Re-open pending
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!visible.length ? (
        <p className="text-sm text-[#7a5c4e]">
          {filter === "pending"
            ? "No products waiting for approval. Shop portal will submit here."
            : "No products in this filter."}
        </p>
      ) : null}
    </div>
  );
}
