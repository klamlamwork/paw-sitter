"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const METHODS = [
  { key: "card_enabled", label: "Card (Stripe)", detail: "Redirect customers to Stripe Checkout." },
  { key: "etransfer_enabled", label: "Interac e-Transfer", detail: "Customers select e-Transfer; payment remains pending until confirmed." },
  { key: "pay_later_enabled", label: "Pay later", detail: "Customers can submit without paying immediately." },
];

export default function AdminPaymentsToggle({ initial }) {
  const [methods, setMethods] = useState({
    card_enabled: initial?.card_enabled ?? initial?.stripe_enabled ?? false,
    etransfer_enabled: initial?.etransfer_enabled ?? true,
    pay_later_enabled: initial?.pay_later_enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(key, enabled) {
    setSaving(true);
    setError("");
    try {
      if (!initial?.id) throw new Error("No payments settings row found.");
      const next = { ...methods, [key]: enabled };
      const supabase = createClient();
      const { error: err } = await supabase
        .from("sitter_payments")
        .update({
          ...next,
          stripe_enabled: next.card_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initial.id);
      if (err) throw err;
      setMethods(next);
    } catch (err) {
      setError(err.message || "Could not save payment settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
      <h2 className="text-lg font-semibold text-[#3b2a22]">Payments for pet sitting</h2>
      <p className="mt-1 text-[#7a5c4e]">Only enabled methods appear under a customer’s accepted booking.</p>
      <div className="mt-3 space-y-3">
        {METHODS.map((method) => (
          <label key={method.key} className="flex items-start gap-3 rounded-xl border border-[#e8d5c4] bg-white p-3">
            <input
              type="checkbox"
              checked={methods[method.key]}
              disabled={saving}
              onChange={(e) => save(method.key, e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-medium text-[#3b2a22]">{method.label}</span>
              <span className="block text-xs text-[#7a5c4e]">{method.detail}</span>
            </span>
          </label>
        ))}
      </div>
      {saving ? <p className="mt-2 text-xs text-[#7a5c4e]">Saving…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
