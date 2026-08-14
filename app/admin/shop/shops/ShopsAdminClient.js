"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";
const SEQ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function emptyCreate(defaultProductBrand) {
  return {
    name: "",
    slug: "",
    is_product_brand: !!defaultProductBrand,
    owner_profile_id: "",
    logo_url: "",
    description: "",
    seo_title: "",
    seo_description: "",
    status: "active",
    home_brand_sort: "",
    home_retailer_sort: "",
    expiry_hide_days: "0",
    expiry_discount_days: "7",
    expiry_discount_pct: "0",
  };
}

function formFromShop(s) {
  return {
    name: s.name || "",
    slug: s.slug || "",
    is_product_brand: !!s.is_product_brand,
    owner_profile_id: s.owner_profile_id || "",
    logo_url: s.logo_url || "",
    description: s.description || "",
    seo_title: s.seo_title || "",
    seo_description: s.seo_description || "",
    status: s.status || "active",
    home_brand_sort: s.home_brand_sort ?? "",
    home_retailer_sort: s.home_retailer_sort ?? "",
    expiry_hide_days: String(s.expiry_hide_days ?? 0),
    expiry_discount_days: String(s.expiry_discount_days ?? 7),
    expiry_discount_pct: String(s.expiry_discount_pct ?? 0),
  };
}

function sortVal(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function ownerLabel(p) {
  if (!p) return null;
  return p.email + (p.full_name ? ` (${p.full_name})` : "");
}

function shopPayload(form) {
  const isBrand = !!form.is_product_brand;
  return {
    name: form.name.trim(),
    slug: slugifyShop(form.slug || form.name),
    shop_type: isBrand ? "brand" : "vendor",
    is_product_brand: isBrand,
    brand_id: null,
    owner_profile_id: form.owner_profile_id || null,
    description: form.description.trim(),
    logo_url: form.logo_url.trim(),
    seo_title: form.seo_title.trim(),
    seo_description: form.seo_description.trim(),
    status: form.status,
    home_brand_sort: isBrand ? sortVal(form.home_brand_sort) : null,
    home_retailer_sort: !isBrand ? sortVal(form.home_retailer_sort) : null,
    expiry_hide_days: clampInt(form.expiry_hide_days, 0, 90, 0),
    expiry_discount_days: clampInt(form.expiry_discount_days, 0, 90, 7),
    expiry_discount_pct: clampInt(form.expiry_discount_pct, 0, 90, 0),
    updated_at: new Date().toISOString(),
  };
}

export default function ShopsAdminClient({
  initialShops,
  profiles,
  defaultProductBrand = false,
}) {
  const router = useRouter();
  const [shops, setShops] = useState(initialShops || []);
  const [createForm, setCreateForm] = useState(() => emptyCreate(defaultProductBrand));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const setCreate = (k, v) => setCreateForm((f) => ({ ...f, [k]: v }));
  const setEdit = (k, v) => setEditForm((f) => ({ ...f, [k]: v }));

  async function addShop(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    if (!createForm.name.trim()) {
      setError("Name required");
      setBusy(false);
      return;
    }
    const payload = shopPayload(createForm);
    const supabase = createClient();
    const { data, error: err } = await supabase.from("shop_shops").insert(payload).select("*").single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const owner = payload.owner_profile_id
      ? profiles.find((p) => p.id === payload.owner_profile_id) || null
      : null;
    setShops((list) => [...list, { ...data, owner }].sort((a, b) => a.name.localeCompare(b.name)));
    setCreateForm(emptyCreate(defaultProductBrand));
    setOk("Shop created.");
    router.refresh();
  }

  function startEdit(s) {
    setError("");
    setOk("");
    setEditingId(s.id);
    setEditForm(formFromShop(s));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId || !editForm) return;
    setBusy(true);
    setError("");
    setOk("");
    if (!editForm.name.trim()) {
      setError("Name required");
      setBusy(false);
      return;
    }
    const payload = shopPayload(editForm);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_shops")
      .update(payload)
      .eq("id", editingId)
      .select("*")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const owner = payload.owner_profile_id
      ? profiles.find((p) => p.id === payload.owner_profile_id) || null
      : null;
    setShops((list) =>
      list
        .map((x) => (x.id === editingId ? { ...x, ...data, owner } : x))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingId(null);
    setEditForm(null);
    setOk("Shop updated.");
    router.refresh();
  }

  async function deleteShop(s) {
    const sure = window.confirm(
      `Delete shop "${s.name}"? Offers for this shop are removed. Products stay but lose this shop link.`
    );
    if (!sure) return;
    setBusy(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_shops").delete().eq("id", s.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setShops((list) => list.filter((x) => x.id !== s.id));
    if (editingId === s.id) cancelEdit();
    setOk(`Deleted ${s.name}.`);
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={addShop} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Add shop</h2>
        <ShopFields form={createForm} set={setCreate} profiles={profiles} />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create shop"}
        </button>
      </form>

      <ul className="space-y-3">
        {shops.map((s) => (
          <li key={s.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            {editingId === s.id && editForm ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <p className="font-semibold text-[#3b2a22]">Edit {s.name}</p>
                <ShopFields form={editForm} set={setEdit} profiles={profiles} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-full border border-[#e8d5c4] px-4 py-1.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#3b2a22]">
                      {s.name}
                      {s.is_product_brand ? (
                        <span className="ml-2 rounded-full bg-[#c45c26]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#c45c26]">
                          Product brand
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full border border-[#e8d5c4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7a5c4e]">
                          Retailer
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#7a5c4e]">/shop/shops/{s.slug} · {s.status}</p>
                    <p className="mt-2 text-xs">
                      <span className="font-semibold text-[#3b2a22]">Owner email: </span>
                      {s.owner?.email ? (
                        <span className="text-[#5c4033]">{s.owner.email}</span>
                      ) : (
                        <span className="text-amber-700">Not assigned</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteShop(s)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {!shops.length ? <p className="text-sm text-[#7a5c4e]">No shops yet.</p> : null}
    </div>
  );
}

function ShopFields({ form, set, profiles }) {
  return (
    <>
      <label className="block text-sm font-medium">
        Name
        <input
          className={inp}
          value={form.name}
          required
          onChange={(e) => {
            set("name", e.target.value);
            if (!form.slug) set("slug", slugifyShop(e.target.value));
          }}
        />
      </label>
      <label className="block text-sm font-medium">
        Slug
        <input className={inp + " font-mono"} value={form.slug} onChange={(e) => set("slug", e.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={!!form.is_product_brand}
          onChange={(e) => set("is_product_brand", e.target.checked)}
        />
        <span className="font-semibold">This is a product brand</span>
      </label>
      <label className="block text-sm font-medium">
        Owner account
        <select
          className={inp}
          value={form.owner_profile_id}
          onChange={(e) => set("owner_profile_id", e.target.value)}
        >
          <option value="">— none —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {ownerLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Status
        <select className={inp} value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="active">active</option>
          <option value="pending">pending</option>
          <option value="suspended">suspended</option>
        </select>
      </label>
      {form.is_product_brand ? (
        <label className="block text-sm font-medium">
          Sequence on /shop/ “Shop by brand” (1–10)
          <select
            className={inp}
            value={form.home_brand_sort}
            onChange={(e) => set("home_brand_sort", e.target.value)}
          >
            <option value="">— not listed first —</option>
            {SEQ.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm font-medium">
          Sequence on /shop/ “Retailers” (1–10)
          <select
            className={inp}
            value={form.home_retailer_sort}
            onChange={(e) => set("home_retailer_sort", e.target.value)}
          >
            <option value="">— not listed first —</option>
            {SEQ.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">
        Logo URL
        <input className={inp} value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Description
        <textarea
          className={inp}
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <label className="block text-sm font-medium">
        SEO title
        <input className={inp} value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        SEO description
        <textarea
          className={inp}
          rows={2}
          value={form.seo_description}
          onChange={(e) => set("seo_description", e.target.value)}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Hide when ≤ days left
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={form.expiry_hide_days}
            onChange={(e) => set("expiry_hide_days", e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Discount when ≤ days left
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={form.expiry_discount_days}
            onChange={(e) => set("expiry_discount_days", e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Discount %
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={form.expiry_discount_pct}
            onChange={(e) => set("expiry_discount_pct", e.target.value)}
          />
        </label>
      </div>
    </>
  );
}
