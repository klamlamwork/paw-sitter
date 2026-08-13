"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { batchStatusFromExpiry, daysUntil, isBatchExpiryMode } from "@/lib/shopInventory";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

function BatchesPanel({ variant, shopId }) {
  const [batches, setBatches] = useState([]);
  const [lot, setLot] = useState("");
  const [qty, setQty] = useState("0");
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("shop_product_batches")
      .select("*")
      .eq("variant_id", variant.id)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    if (err) {
      setError(err.message);
      return;
    }
    setBatches(data || []);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variant.id]);

  async function addBatch(e) {
    e.preventDefault();
    if (!expiry) {
      setError("Expiry date required for this product type");
      return;
    }
    setBusy(true);
    setError("");
    const q = Math.max(0, parseInt(qty, 10) || 0);
    const status = batchStatusFromExpiry(expiry, q);
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_product_batches").insert({
      variant_id: variant.id,
      shop_id: shopId,
      lot_code: lot.trim(),
      qty_on_hand: q,
      expiry_date: expiry,
      status,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setLot("");
    setQty("0");
    setExpiry("");
    // Keep variant stock_qty as sum of active batches (convenience)
    await refreshVariantStock(variant.id);
    load();
  }

  async function refreshVariantStock(variantId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("shop_product_batches")
      .select("qty_on_hand, status, expiry_date")
      .eq("variant_id", variantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sum = (data || []).reduce((acc, b) => {
      if (b.status === "held" || b.status === "depleted" || b.status === "expired") return acc;
      if (b.expiry_date) {
        const d = new Date(b.expiry_date + "T12:00:00");
        if (d < today) return acc;
      }
      return acc + (b.qty_on_hand || 0);
    }, 0);
    await supabase
      .from("shop_product_variants")
      .update({ stock_qty: sum, track_stock: true, updated_at: new Date().toISOString() })
      .eq("id", variantId);
  }

  async function patchBatch(b, fields) {
    const supabase = createClient();
    const next = { ...b, ...fields };
    const status =
      fields.status ||
      batchStatusFromExpiry(next.expiry_date, next.qty_on_hand);
    const { error: err } = await supabase
      .from("shop_product_batches")
      .update({ ...fields, status, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshVariantStock(variant.id);
    load();
  }

  async function removeBatch(b) {
    if (!confirm("Delete this batch?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("shop_product_batches").delete().eq("id", b.id);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshVariantStock(variant.id);
    load();
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-[#e8d5c4] bg-[#fff8f0]/40 p-2">
      <button
        type="button"
        className="text-[11px] font-semibold text-[#c45c26]"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide batches" : "Batches & expiry"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
          <ul className="space-y-1.5">
            {batches.map((b) => {
              const days = daysUntil(b.expiry_date);
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8d5c4] bg-white px-2 py-1.5 text-[11px]"
                >
                  <span className="font-semibold">{b.lot_code || "—"}</span>
                  <span>exp {b.expiry_date || "—"}</span>
                  {days != null ? (
                    <span
                      className={
                        days < 0
                          ? "font-bold text-red-600"
                          : days <= 14
                            ? "font-bold text-amber-700"
                            : "text-[#7a5c4e]"
                      }
                    >
                      {days < 0 ? `expired ${-days}d ago` : `${days}d left`}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[#fff8f0] px-1.5 py-0.5 uppercase text-[9px]">
                    {b.status}
                  </span>
                  <label className="flex items-center gap-1">
                    qty
                    <input
                      type="number"
                      min="0"
                      className="w-16 rounded border border-[#e8d5c4] px-1 py-0.5"
                      defaultValue={b.qty_on_hand}
                      onBlur={(e) => {
                        const q = Math.max(0, parseInt(e.target.value, 10) || 0);
                        if (q !== b.qty_on_hand) patchBatch(b, { qty_on_hand: q });
                      }}
                    />
                  </label>
                  <button type="button" className="text-red-600" onClick={() => removeBatch(b)}>
                    Delete
                  </button>
                </li>
              );
            })}
            {!batches.length ? (
              <li className="text-[11px] text-[#7a5c4e]">No batches yet.</li>
            ) : null}
          </ul>
          <form onSubmit={addBatch} className="grid gap-1.5 sm:grid-cols-4">
            <input
              className={inp}
              placeholder="Lot code"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
            />
            <input
              type="date"
              className={inp}
              required
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
            <input
              type="number"
              min="0"
              className={inp}
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[#c45c26] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "…" : "Add batch"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductVariantsEditor({
  productId,
  shopId,
  initialVariants = [],
  inventoryMode = "simple",
  currency = "CAD",
}) {
  const batchMode = isBatchExpiryMode(inventoryMode);
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
        stock_qty: batchMode ? 0 : Math.max(0, parseInt(stock, 10) || 0),
        track_stock: true,
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
    setOk(
      batchMode
        ? "Variety added. Open Batches & expiry to add lots (no admin approval)."
        : "Variety added (live — no admin approval)."
    );
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
        Mode:{" "}
        <strong>{batchMode ? "Batch + expiry" : "Simple stock"}</strong>
        {" · "}Updates are live (no admin approval).
      </p>

      {error ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="mt-2 rounded-lg bg-green-50 px-2 py-1 text-xs text-green-800">{ok}</p> : null}

      <ul className="mt-3 space-y-2">
        {variants.map((v) => (
          <li key={v.id} className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-xs">
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
                    Price override
                    <input
                      type="number"
                      step="0.01"
                      className={inp}
                      placeholder="base"
                      defaultValue={v.price_cents != null ? String(v.price_cents / 100) : ""}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const cents = raw === "" ? null : Math.round(Number(raw) * 100);
                        if (cents !== v.price_cents)
                          patchVariant(v, {
                            price_cents: Number.isFinite(cents) ? cents : null,
                          });
                      }}
                    />
                  </label>
                  {!batchMode ? (
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
                  ) : (
                    <div className="text-[10px] text-[#7a5c4e]">
                      Sellable qty (from batches):{" "}
                      <strong className="text-[#3b2a22]">{v.stock_qty ?? 0}</strong>
                    </div>
                  )}
                  <div className="flex flex-col justify-end gap-1 pb-1">
                    {!batchMode ? (
                      <label className="flex items-center gap-1.5 text-[11px]">
                        <input
                          type="checkbox"
                          checked={!!v.track_stock}
                          onChange={(e) => patchVariant(v, { track_stock: e.target.checked })}
                        />
                        Track stock
                      </label>
                    ) : null}
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
                {batchMode ? <BatchesPanel variant={v} shopId={shopId} /> : null}
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
          <li className="text-xs text-[#7a5c4e]">No varieties yet.</li>
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
          {!batchMode ? (
            <input
              type="number"
              min="0"
              className={inp}
              placeholder="Stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          ) : (
            <div className="flex items-center text-[11px] text-[#7a5c4e]">Stock via batches</div>
          )}
          {!batchMode ? (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              Track stock
            </label>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy || !productId}
          onClick={addVariant}
          className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add variety"}
        </button>
      </div>
    </div>
  );
}
