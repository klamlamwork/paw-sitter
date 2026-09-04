"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KolRequestChanges({ postId }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shop/kol/request-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not request changes.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not request changes.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Request changes</button>;
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
      <label className="block text-xs font-semibold text-[#3b2a22]">Reason shown to the creator
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm" placeholder="Explain what needs to change" />
      </label>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || reason.trim().length < 5} onClick={submit} className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Send request"}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033]">Cancel</button>
      </div>
    </div>
  );
}
