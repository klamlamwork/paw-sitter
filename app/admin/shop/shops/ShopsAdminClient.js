"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugifyShop } from "@/lib/shop";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function ShopsAdminClient({ initialShops, brands, profiles }) {
  const router = useRouter();
  const [shops, setShops] = useState(initialShops || []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shopType, setShopType] = useState("vendor");
  const [brandId, setBrandId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function addShop(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const n = name.trim();
    if (!n) {
      setError("Name required");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_shops")
      .insert({
        name: n,
        slug: slugifyShop(slug || n),
        shop_type: shopType,
        brand_id: brandId || null,
        owner_profile_id: ownerId || null,
        description: description.trim(),
        status,
        updated_at: new Date().toISOString(),
      })
      .select("*, shop_brands(name)")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setShops((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setSlug("");
    setDescription("");
    setBrandId("");
    setOwnerId("");
    setOk("Shop created.");
    router.refresh();
  }

  async function setShopStatus(s, next) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_shops")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    if (err) {
      setError(err.message);
      return;
    }
    setShops((list) => list.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <form onSubmit={addShop} className="space-y-3 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-5">
        <h2 className="font-semibold">Add shop (admin-created account link)</h2>
        <label className="block text-sm font-medium">
          Name
          <input
            className={inp}
            value={name}
            required
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugifyShop(e.target.value));
            }}
          />
        </label>
        <label className="block text-sm font-medium">
          Slug
          <input className={inp + " font-mono"} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Type
          <select className={inp} value={shopType} onChange={(e) => setShopType(e.target.value)}>
            <option value="vendor">Vendor</option>
            <option value="brand">Brand (Product Brand shop)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Linked brand (optional)
          <select className={inp} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">—</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Owner profile (optional)
          <select className={inp} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">—</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.email}{p.full_name ? ` (${p.full_name})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Description
          <textarea
            className={inp}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Status
          <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Create shop"}
        </button>
      </form>

      <ul className="space-y-2">
        {shops.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#3b2a22]">{s.name}</p>
                <p className="text-xs text-[#7a5c4e]">
                  /shop/shops/{s.slug} · {s.shop_type}
                  {s.shop_brands?.name ? ` · brand: ${s.shop_brands.name}` : ""}
                </p>
              </div>
              <select
                value={s.status}
                onChange={(e) => setShopStatus(s, e.target.value)}
                className="rounded-full border border-[#e8d5c4] px-2 py-1 text-xs"
              >
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
          </li>
        ))}
      </ul>
      {!shops.length ? <p className="text-sm text-[#7a5c4e]">No shops yet.</p> : null}
    </div>
  );
}
