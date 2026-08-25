"use client";

import { useEffect, useState } from "react";

const TOGGLES = [
  { key: "email_transactional", label: "Transactional email", hint: "Booking and order mail. On by default." },
  { key: "notify_booking_updates", label: "Booking updates", hint: "Requests, accepts, declines, and cancels." },
  { key: "notify_order_updates", label: "Order updates", hint: "Receipts, shipped, ready, delivered." },
  { key: "notify_reminders", label: "Reminders", hint: "24-hour booking reminder and sitter daily overview." },
  { key: "sms_opt_in", label: "SMS (opt-in)", hint: "Off by default. Test numbers only for now." },
  { key: "email_marketing", label: "Marketing email", hint: "Off. No marketing mail is sent yet." },
];

export default function NotificationPrefsClient() {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/account/notification-prefs");
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not load preferences");
      else setPrefs(data);
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/account/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setOk("Preferences saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) return <p className="mt-6 text-sm text-[#7a5c4e]">{error || "Loading…"}</p>;

  return (
    <form onSubmit={save} className="mt-6 space-y-3">
      {TOGGLES.map((row) => (
        <label key={row.key} className="flex items-start gap-3 rounded-2xl border border-[#e8d5c4] bg-white p-4 text-sm">
          <input
            type="checkbox"
            checked={!!prefs[row.key]}
            onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-[#3b2a22]">{row.label}</span>
            <span className="mt-0.5 block text-xs text-[#7a5c4e]">{row.hint}</span>
          </span>
        </label>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-800">{ok}</p> : null}
      <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
