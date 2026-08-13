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

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ProductsModerateClient({ initialProducts, adminId, retailers = [] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts || []);
  const [filter, setFilter] = useState("needs");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState("");
  const [retailOpenId, setRetailOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [pickUrl, setPickUrl] = useState("");
  const [highlight, setHighlight] = useState(0);

  const visible = useMemo(() => {
    if (filter === "all") return products;
    if (filter === "needs")
      return products.filter((p) => p.status === "pending" || p.has_pending_edit);
    if (filter === "updates") return products.filter((p) => p.has_pending_edit);
    if (filter === "archived") return products.filter((p) => p.status === "archived");
    return products.filter((p) => p.status === filter);
  }, [products, filter]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !retailOpenId) return [];
    const p = products.find((x) => x.id === retailOpenId);
    const taken = new Set((p?.eligible_retailers || []).map((o) => o.shop_id));
    return retailers
      .filter((r) => !taken.has(r.id))
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.slug || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, retailOpenId, retailers, products]);

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
    await supabase
      .from("shop_products")
      .update({ approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", p.id);

    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
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
        x.id === p.id ? { ...x, has_pending_edit: false, pending_snapshot: null } : x
      )
    );
    setOk("Pending update discarded. Live product unchanged.");
    router.refresh();
  }

  async function addRetailer(p, shop) {
    const url = pickUrl.trim();
    if (!url) {
      setError("Enter the retailer product page URL before adding.");
      return;
    }
    setBusyId(p.id);
    setError("");
    setOk("");
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_product_offers")
      .upsert(
        {
          product_id: p.id,
          shop_id: shop.id,
          product_page_url: url,
          status: "approved",
          show_affiliate: false,
          show_add_to_cart: false,
          affiliate_url: "",
          is_default: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,shop_id" }
      )
      .select("id, product_id, shop_id, product_page_url, status")
      .single();
    setBusyId("");
    if (err) {
      setError(err.message);
      return;
    }
    const row = {
      ...data,
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        logo_url: shop.logo_url,
      },
    };
    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              eligible_retailers: [
                ...(x.eligible_retailers || []).filter((o) => o.shop_id !== shop.id),
                row,
              ],
            }
          : x
      )
    );
    setQuery("");
    setPickUrl("");
    setOk(`Added ${shop.name} as eligible retailer.`);
    router.refresh();
  }

  async function updateRetailerUrl(p, offer, url) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_product_offers")
      .update({ product_page_url: url.trim(), updated_at: new Date().toISOString() })
      .eq("id", offer.id);
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              eligible_retailers: (x.eligible_retailers || []).map((o) =>
                o.id === offer.id ? { ...o, product_page_url: url.trim() } : o
              ),
            }
          : x
      )
    );
  }

  async function removeRetailer(p, offer) {
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_product_offers").delete().eq("id", offer.id);
    if (err) {
      setError(err.message);
      return;
    }
    setProducts((list) =>
      list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              eligible_retailers: (x.eligible_retailers || []).filter((o) => o.id !== offer.id),
            }
          : x
      )
    );
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
          <li key={p.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[#3b2a22]">{p.name}</p>
                <p className="text-xs text-[#7a5c4e]">
                  /shop/p/{p.slug}
                  {p.brand_shop?.name ? ` · brand: ${p.brand_shop.name}` : ""}
                </p>
                {p.has_pending_edit ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Pending update awaiting approval
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                  {p.status}
                  {p.has_pending_edit ? " + update" : ""}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setRetailOpenId(retailOpenId === p.id ? "" : p.id);
                    setQuery("");
                    setPickUrl("");
                  }}
                  className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                >
                  {retailOpenId === p.id ? "Hide retailers" : "Eligible retailers"}
                </button>

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
                      className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
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
                    className="rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                ) : null}
                {p.status === "approved" ? (
                  <Link href={`/shop/p/${p.slug}`} className="text-xs font-semibold text-[#c45c26]">
                    View live
                  </Link>
                ) : null}
                {p.status === "approved" && !p.has_pending_edit ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setStatus(p, "archived")}
                    className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                  >
                    Inactive
                  </button>
                ) : null}
              </div>
            </div>

            {retailOpenId === p.id ? (
              <div className="mt-3 space-y-3 rounded-xl border border-[#e8d5c4] bg-[#fff8f0]/80 p-3">
                <p className="text-xs font-semibold text-[#3b2a22]">Eligible retailers</p>
                <p className="text-[11px] text-[#7a5c4e]">
                  Type a retailer name, pick from suggestions, set their product page URL, then Add.
                  Logos appear on the public PDP under “Eligible retailers”.
                </p>

                <ul className="space-y-2">
                  {(p.eligible_retailers || []).map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e8d5c4] bg-white px-3 py-2"
                    >
                      {o.shop?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.shop.logo_url}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff8f0] text-xs font-bold text-[#c45c26]">
                          {(o.shop?.name || "?").slice(0, 1)}
                        </span>
                      )}
                      <span className="min-w-[6rem] text-xs font-semibold">{o.shop?.name}</span>
                      <input
                        className={inp + " min-w-[12rem] flex-1 text-xs"}
                        defaultValue={o.product_page_url || ""}
                        placeholder="https://… retailer product page"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (o.product_page_url || "")) {
                            updateRetailerUrl(p, o, e.target.value);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeRetailer(p, o)}
                        className="text-xs font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {!(p.eligible_retailers || []).length ? (
                    <li className="text-xs text-[#7a5c4e]">No retailers linked yet.</li>
                  ) : null}
                </ul>

                <div className="relative">
                  <label className="block text-xs font-medium text-[#7a5c4e]">
                    Add retailer (type to search)
                    <input
                      className={inp}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setHighlight(0);
                      }}
                      onKeyDown={(e) => {
                        if (!suggestions.length) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlight((h) => Math.max(0, h - 1));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const s = suggestions[highlight];
                          if (s) {
                            setQuery(s.name);
                          }
                        }
                      }}
                      placeholder="Start typing retailer name…"
                      autoComplete="off"
                    />
                  </label>
                  {suggestions.length ? (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#e8d5c4] bg-white py-1 shadow-lg">
                      {suggestions.map((s, i) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={
                              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm " +
                              (i === highlight ? "bg-[#fff8f0]" : "hover:bg-[#fff8f0]")
                            }
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => {
                              setQuery(s.name);
                            }}
                          >
                            {s.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.logo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff8f0] text-[10px] font-bold">
                                {s.name.slice(0, 1)}
                              </span>
                            )}
                            {s.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <label className="block text-xs font-medium text-[#7a5c4e]">
                  Retailer product page URL
                  <input
                    className={inp}
                    value={pickUrl}
                    onChange={(e) => setPickUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>

                <button
                  type="button"
                  disabled={busyId === p.id}
                  className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  onClick={() => {
                    const match =
                      suggestions[highlight] ||
                      retailers.find(
                        (r) => r.name.toLowerCase() === query.trim().toLowerCase()
                      );
                    if (!match) {
                      setError("Pick a retailer from the suggestions list.");
                      return;
                    }
                    addRetailer(p, match);
                  }}
                >
                  Add retailer
                </button>
              </div>
            ) : null}

            {openId === p.id && p.pending_snapshot ? (
              <div className="mt-3 rounded-xl bg-[#fff8f0] px-3 py-2 text-xs text-[#5c4033]">
                <p className="font-semibold text-[#3b2a22]">Proposed changes</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Name: {p.pending_snapshot.name}</li>
                  <li>Slug: {p.pending_snapshot.slug}</li>
                  <li>Gallery: {(p.pending_snapshot.media || []).length}</li>
                  <li>Longevity: {(p.pending_snapshot.longevity_items || []).length}</li>
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {!visible.length ? <p className="text-sm text-[#7a5c4e]">Nothing in this filter.</p> : null}
    </div>
  );
}
