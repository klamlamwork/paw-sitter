"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applySnapshotToProduct } from "@/lib/shopProductPending";

const FILTERS = [
  { id: "needs", label: "Needs review" },
  { id: "all", label: "All" },
  { id: "pending", label: "New pending" },
  { id: "updates", label: "Pending updates" },
  { id: "approved", label: "Approved" },
  { id: "archived", label: "Inactive" },
  { id: "rejected", label: "Rejected" },
];

export default function ProductsModerateClient({ initialProducts, adminId }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts || []);
  const [filter, setFilter] = useState("needs");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState("");

  const visible = useMemo(() => {
    if (filter === "all") return products;
    if (filter === "needs")
      return products.filter((p) => p.status === "pending" || p.has_pending_edit);
    if (filter === "updates") return products.filter((p) => p.has_pending_edit);
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
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? adminId : null,
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

  async function approveUpdate(p) {
    if (!p.pending_snapshot) {
      setError("No pending snapshot");
      return;
    }
    setBusyId(p.id);
    setError("");
    setOk("");
    const supabase = createClient();
    const err = await applySnapshotToProduct(supabase, p.id, p.pending_snapshot);
    setBusyId("");
    if (err) {
      setError(err.message || String(err));
      return;
    }
    // mark approved_by
    await supabase
      .from("shop_products")
      .update({ approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", p.id);

    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              ...p.pending_snapshot,
              status: "approved",
              has_pending_edit: false,
              pending_snapshot: null,
              name: p.pending_snapshot.name || x.name,
              slug: p.pending_snapshot.slug || x.slug,
            }
          : x
      )
    );
    setOk(`Approved update for “${p.pending_snapshot.name || p.name}”.`);
    router.refresh();
  }

  async function rejectUpdate(p) {
    setBusyId(p.id);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_products")
      .update({
        has_pending_edit: false,
        pending_snapshot: null,
        pending_submitted_at: null,
        pending_submitted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    setBusyId("");
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              has_pending_edit: false,
              pending_snapshot: null,
            }
          : x
      )
    );
    setOk("Pending update discarded. Live product unchanged.");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

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
                  {p.brand_shop?.name ? ` · ${p.brand_shop.name}` : ""}
                </p>
                {p.has_pending_edit ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Pending update awaiting approval
                    {p.pending_snapshot?.name && p.pending_snapshot.name !== p.name
                      ? ` → “${p.pending_snapshot.name}”`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                  {p.status}
                  {p.has_pending_edit ? " + update" : ""}
                </span>

                {p.has_pending_edit ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => setOpenId(openId === p.id ? "" : p.id)}
                      className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                    >
                      {openId === p.id ? "Hide diff" : "Review update"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => approveUpdate(p)}
                      className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Approve update
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => rejectUpdate(p)}
                      className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    >
                      Discard update
                    </button>
                  </>
                ) : null}

                {!p.has_pending_edit && (p.status === "pending" || p.status === "draft") ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "approved")}
                    className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                ) : null}
                {!p.has_pending_edit && p.status === "pending" ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "rejected")}
                    className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                  >
                    Reject
                  </button>
                ) : null}
                {p.status === "approved" ? (
                  <>
                    <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">
                      View live
                    </Link>
                    {!p.has_pending_edit ? (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => setStatus(p, "archived")}
                        className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                      >
                        Inactive
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {openId === p.id && p.pending_snapshot ? (
              <div className="mt-3 rounded-xl bg-[#fff8f0] px-3 py-2 text-xs text-[#5c4033]">
                <p className="font-semibold text-[#3b2a22]">Proposed changes</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Name: {p.pending_snapshot.name}</li>
                  <li>Slug: {p.pending_snapshot.slug}</li>
                  <li>
                    Price:{" "}
                    {p.pending_snapshot.hide_price
                      ? "hidden"
                      : p.pending_snapshot.price_cents != null
                        ? `$${(p.pending_snapshot.price_cents / 100).toFixed(2)}`
                        : "—"}
                  </li>
                  <li>Short: {p.pending_snapshot.short_description || "—"}</li>
                  <li>
                    Gallery images: {(p.pending_snapshot.media || []).length}
                  </li>
                  <li>
                    Longevity chips: {(p.pending_snapshot.longevity_items || []).length}
                  </li>
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {!visible.length ? (
        <p className="text-sm text-[#7a5c4e]">Nothing in this filter.</p>
      ) : null}
    </div>
  );
}
