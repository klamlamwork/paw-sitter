"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VerifiedKolMediaUpload from "./VerifiedKolMediaUpload";

export default function RateProductForm({ itemId, options = [] }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ticks, setTicks] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id) {
    setTicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, rating, title, body, option_ids: [...ticks] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save review");
      router.push("/shop/orders?rated=1");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not save review");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-[#e8d5c4] bg-white p-5">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className={"text-2xl " + (n <= rating ? "text-[#d4a017]" : "text-[#efd09a]")} aria-label={`${n} stars`}>★</button>
        ))}
      </div>
      <input className="w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="Review title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="min-h-[120px] w-full border border-[#e8d5c4] px-3 py-2 text-sm" placeholder="What did you think?" value={body} onChange={(e) => setBody(e.target.value)} />
      {options.length ? (
        <div>
          <p className="text-sm font-semibold text-[#3b2a22]">What stood out? Tick all that apply.</p>
          <ul className="mt-2 space-y-2">
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={ticks.has(opt.id)} onChange={() => toggle(opt.id)} className="mt-1" />
                  {opt.icon_url ? <img src={opt.icon_url} alt="" className="h-6 w-6 object-contain" /> : null}
                  <span><span className="font-semibold">{opt.label}</span>{opt.description ? <span className="block text-xs text-[#7a5c4e]">{opt.description}</span> : null}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <VerifiedKolMediaUpload itemId={itemId} title={title} body={body} rating={rating} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-full bg-[#c45c26] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Submit verified review"}</button>
    </form>
  );
}
