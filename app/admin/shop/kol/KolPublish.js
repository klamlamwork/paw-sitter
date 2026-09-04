"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KolPublish({ postId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shop/kol/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not publish this KOL post.");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not publish this KOL post.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={publish} className="rounded-full bg-[#c45c26] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Publishing…" : "Approve & publish"}</button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
