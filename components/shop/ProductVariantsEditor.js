"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

/**
 * Manage product varieties + stock.
 * Changes save immediately (no admin approval).
 */
export default function ProductVariantsEditor({
  productId,
  shopId,
  initialVariants = [],
  currency = "CAD",
}) {
  const [variants, setVariants] = useState(initialVariants || []);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [trackStock, setTrackStock] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function addVariant(e) {
    e?.preventDefault?.();
    const n = name.trim();
    if (!n) {
      setError("Variety name required");
      return;
    }
    if (!shopId || !productId) {
      setError("Missing shop or product");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    const priceCents =
      price === "" || price == null ? null : Math.round(Number(price) * 100);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_product_variants")
      .insert({
        product_id: productId,
        shop_id: shopId,
        name: n,
        sku: sku.trim(),
        price_cents: Number.isFinite(priceCents) ? priceCents : null,
        currency,
        stock_qty: Math.max(0, parseInt(stock, 10) || 0),
        track_stock: !!trackStock,
        is_active: true,
        sort_order: variants.length,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setVariants((list) => [...list, data]);
    setName("");
    setSku("");
    setPrice("");
    setStock("0");
    setOk("Variety added (live immediately — no admin approval).");
  }

  async function patchVariant(v, fields) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_product_variants")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", v.id);
    if (err) {
      setError(err.message);
      return;
    }
    setVariants((list) => list.map((x) => (x.id === v.id ? { ...x, ...fields } : x)));
  }

  async function removeVariant(v) {
    if (!confirm(`Delete variety "${v.name}"?`)) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_product_variants").delete().eq("id", v.id);
    if (err) {
      setError(err.message);
      return;
    }
    setVariants((list) => list.filter((x) => x.id !== v.id));
  }

  return (
    <div className="rounded-xl border border-[#e8d5c4] bg-[#fff8f0]/50 p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Product varieties & stock</p>
      <p className="mt-0.5 text-[11px] text-[#7a5c4e]">
        Add sizes, packs, colors, etc. Stock and activate/deactivate update instantly —{" "}
        <strong>no admin approval</strong>.
      </p>

      {error ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="mt-2 rounded-lg bg-green-50 px-2 py-1 text-xs text-green-800">{ok}</p> : null}

      <ul className="mt-3 space-y-2">
        {variants.map((v) => (
          <li
            key={v.id}
            className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  className={inp + " font-semibold"}
                  defaultValue={v.name}
                  onBlur={(e) => {
                    const n = e.target.value.trim();
                    if (n && n !== v.name) patchVariant(v, { name: n });
                  }}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block text-[10px] font-medium text-[#7a5c4e]">
                    SKU
                    <input
                      className={inp}
                      defaultValue={v.sku || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (v.sku || ""))
                          patchVariant(v, { sku: e.target.value.trim() });
                      }}
                    />
                  </label>
                  <label className="block text-[10px] font-medium text-[#7a5c4e]">
                    Price override ({currency})
                    <input
                      type="number"
                      step="0.01"
                      className={inp}
                      placeholder="base price"
                      defaultValue={
                        v.price_cents != null ? String(v.price_cents / 100) : ""
                      }
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const cents =
                          raw === "" ? null : Math.round(Number(raw) * 100);
                        const prev = v.price_cents;
                        if (cents !== prev)
                          patchVariant(v, {
                            price_cents: Number.isFinite(cents) ? cents : null,
                          });
                      }}
                    />
                  </label>
                  <label className="block text-[10px] font-medium text-[#7a5c4e]">
                    Stock qty
                    <input
                      type="number"
                      min="0"
                      className={inp}
                      defaultValue={v.stock_qty ?? 0}
                      onBlur={(e) => {
                        const q = Math.max(0, parseInt(e.target.value, 10) || 0);
                        if (q !== v.stock_qty) patchVariant(v, { stock_qty: q });
                      }}
                    />
                  </label>
                  <div className="flex flex-col justify-end gap-1 pb-1">
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={!!v.track_stock}
                        onChange={(e) => patchVariant(v, { track_stock: e.target.checked })}
                      />
                      Track stock
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <input
                        type="checkbox"
                        checked={!!v.is_active}
                        onChange={(e) => patchVariant(v, { is_active: e.target.checked })}
                      />
                      Active on site
                    </label>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeVariant(v)}
                className="text-[11px] font-semibold text-red-600"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!variants.length ? (
          <li className="text-xs text-[#7a5c4e]">No varieties yet — product sells as a single SKU.</li>
        ) : null}
      </ul>

      <div className="mt-3 space-y-2 border-t border-dashed border-[#e8d5c4] pt-3">
        <p className="text-xs font-semibold text-[#5c4033]">Add variety</p>
        <input
          className={inp}
          placeholder="Name (e.g. 500g, Small / Blue)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className={inp} placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <input
            type="number"
            step="0.01"
            className={inp}
            placeholder="Price override"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            type="number"
            min="0"
            className={inp}
            placeholder="Stock"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(e) => setTrackStock(e.target.checked)}
            />
            Track stock
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !productId}
          onClick={addVariant}
          className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add variety"}
        </button>
        {!productId ? (
          <p className="text-[11px] text-amber-800">
            Save/create the product first, then add varieties (they attach to the product id).
          </p>
        ) : null}
      </div>
    </div>
  );
}
