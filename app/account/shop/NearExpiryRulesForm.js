"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inp = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

export default function NearExpiryRulesForm({ shop }) {
  const [hideDays, setHideDays] = useState(String(shop.expiry_hide_days ?? 0));
  const [discDays, setDiscDays] = useState(String(shop.expiry_discount_days ?? 7));
  const [discPct, setDiscPct] = useState(String(shop.expiry_discount_pct ?? 0));
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("shop_shops")
      .update({
        expiry_hide_days: Math.min(90, Math.max(0, parseInt(hideDays, 10) || 0)),
        expiry_discount_days: Math.min(90, Math.max(0, parseInt(discDays, 10) || 0)),
        expiry_discount_pct: Math.min(90, Math.max(0, parseInt(discPct, 10) || 0)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shop.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk("Near-expiry rules saved. They apply on the public product page immediately.");
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-[#e8d5c4] bg-[#fff8f0]/50 p-3">
      <p className="text-sm font-semibold text-[#3b2a22]">Near-expiry storefront rules</p>
      <p className="text-[11px] text-[#7a5c4e]">
        For Food / Treats / Supplements / Litter. Hide lots from shoppers, or auto-discount the
        first-expired lot. No admin approval.
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="text-xs text-green-800">{ok}</p> : null}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-medium text-[#7a5c4e]">
          Hide when ≤ days left (0 = expired only)
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={hideDays}
            onChange={(e) => setHideDays(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-[#7a5c4e]">
          Discount when ≤ days left
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={discDays}
            onChange={(e) => setDiscDays(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-[#7a5c4e]">
          Discount % (0 = off)
          <input
            type="number"
            min="0"
            max="90"
            className={inp}
            value={discPct}
            onChange={(e) => setDiscPct(e.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-[#c45c26] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save rules"}
      </button>
    </form>
  );
}
