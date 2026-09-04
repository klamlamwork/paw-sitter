"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function GoldTick() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#d4a017" />
      <path d="M5.5 10.3 8.4 13.2 14.6 6.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductReviewsMount() {
  const path = usePathname() || "";
  const match = path.match(/^\/shop\/p\/([^/]+)$/);
  const slug = match ? decodeURIComponent(match[1]) : "";
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    if (!slug) { setReviews(null); return; }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/shop/reviews?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!cancelled && res.ok) setReviews(data.reviews || []);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (!slug || !reviews) return null;
  const avg = reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0;
  const verifiedCount = reviews.filter((r) => r.verified_purchase !== false).length;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
      <h2 className="text-xl font-bold text-[#3b2a22]">Reviews</h2>
      {reviews.length ? <p className="mt-1 text-sm text-[#5c4033]">{avg.toFixed(1)} / 5 · {reviews.length} review{reviews.length === 1 ? "" : "s"}{verifiedCount ? ` · ${verifiedCount} verified purchase${verifiedCount === 1 ? "" : "s"}` : ""}</p> : <p className="mt-2 text-sm text-[#7a5c4e]">No verified reviews yet.</p>}
      <ul className="mt-4 space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
            <p className="text-sm font-semibold text-[#c77e10]">{r.rating}/5</p>
            {r.title ? <p className="mt-1 font-semibold text-[#3b2a22]">{r.title}</p> : null}
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#3b2a22]">{r.body}</p>
            {r.verified_purchase !== false ? <p className="mt-2 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : null}
            {r.ticks?.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.ticks.map((t) => (
                  <li key={t.id} className="inline-flex items-center gap-1 rounded-full bg-[#fff8f0] px-2 py-1 text-xs font-semibold text-[#5a4018]">
                    <GoldTick />
                    {t.icon_url ? <img src={t.icon_url} alt="" className="h-4 w-4 object-contain" /> : null}
                    {t.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
