"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { slugifyTag } from "@/lib/shopTags";

export default function ProductBrandTagsEditor({ products = [], initialTags = [] }) {
  const [tags, setTags] = useState(initialTags);
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      (products || []).map((p) => [
        p.id,
        {
          brand_name: p.brand_name || "",
          tagIds: new Set(p.tag_ids || []),
        },
      ])
    )
  );
  const [draftTag, setDraftTag] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const tagList = useMemo(() => tags, [tags]);

  function setRow(id, patch) {
    setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function addTag() {
    const name = draftTag.trim();
    const slug = slugifyTag(name);
    if (!name || !slug) return;
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.from("shop_tags").insert({ name, slug }).select("id, name, slug").single();
    if (err) {
      const existing = tags.find((t) => t.slug === slug);
      if (existing) {
        setDraftTag("");
        return;
      }
      setError(err.message);
      return;
    }
    setTags((list) => [...list, data]);
    setDraftTag("");
  }

  async function saveProduct(product) {
    const row = rows[product.id] || { brand_name: "", tagIds: new Set() };
    setBusyId(product.id);
    setError("");
    setOk("");
    const supabase = createClient();
    const { error: brandErr } = await supabase
      .from("shop_products")
      .update({ brand_name: (row.brand_name || "").trim() || null, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (brandErr) {
      setBusyId("");
      setError(brandErr.message);
      return;
    }
    await supabase.from("shop_product_tags").delete().eq("product_id", product.id);
    const ids = [...(row.tagIds || [])];
    if (ids.length) {
      const { error: tagErr } = await supabase.from("shop_product_tags").insert(ids.map((tag_id) => ({ product_id: product.id, tag_id })));
      if (tagErr) {
        setBusyId("");
        setError(tagErr.message);
        return;
      }
    }
    setBusyId("");
    setOk(`Saved brand and tags for ${product.name}.`);
  }

  if (!products.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white p-4">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Brand & tags</h2>
      <p className="mt-1 text-xs text-[#7a5c4e]">
        Set a brand name and tags after you create a product. Tags power public pages at /shop/tags. This does not replace product create, gallery, or Rate now.
      </p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {ok ? <p className="mt-2 text-xs text-green-700">{ok}</p> : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          New tag
          <input className="mt-1 w-48 rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm" value={draftTag} onChange={(e) => setDraftTag(e.target.value)} />
        </label>
        <button type="button" onClick={addTag} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">Add tag</button>
      </div>
      <ul className="mt-4 space-y-4">
        {products.map((product) => {
          const row = rows[product.id] || { brand_name: "", tagIds: new Set() };
          return (
            <li key={product.id} className="rounded-xl border border-[#f0e0d2] p-3">
              <p className="text-sm font-semibold text-[#3b2a22]">{product.name}</p>
              <label className="mt-2 block text-xs">
                Brand
                <input
                  className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm"
                  value={row.brand_name}
                  onChange={(e) => setRow(product.id, { brand_name: e.target.value })}
                  placeholder="Brand name"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tagList.map((tag) => {
                  const on = row.tagIds?.has(tag.id);
                  return (
                    <label key={tag.id} className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={!!on}
                        onChange={() => {
                          const next = new Set(row.tagIds || []);
                          if (next.has(tag.id)) next.delete(tag.id);
                          else next.add(tag.id);
                          setRow(product.id, { tagIds: next });
                        }}
                      />
                      {tag.name}
                    </label>
                  );
                })}
              </div>
              <button type="button" disabled={busyId === product.id} onClick={() => saveProduct(product)} className="mt-2 rounded-full bg-[#c45c26] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
                {busyId === product.id ? "Saving…" : "Save brand & tags"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
