"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminPaymentsToggle({ initial }) {
  const [enabled, setEnabled] = useState(!!initial?.stripe_enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(next) {
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const id = initial?.id;
      if (!id) throw new Error("No payments row found.");
      const { error: err } = await supabase
        .from("sitter_payments")
        .update({ stripe_enabled: next, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
      setEnabled(next);
    } catch (err) {
      setError(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Payments for pet sitting</h2>
      <p className="mt-1 text-[#7a5c4e]">Enable Stripe card payments for sitter bookings. Interac e-Transfer and Pay later remain available regardless.</p>
      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => save(e.target.checked)}
            disabled={saving}
            className="h-4 w-4"
          />
        </label>
        <span className="font-medium">Enable Stripe payments for pet sitting</span>
        {saving && <span className="text-[#7a5c4e]">Saving…</span>}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
