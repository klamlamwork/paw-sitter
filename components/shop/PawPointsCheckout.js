"use client";

import { useEffect, useState } from "react";

function centsFromPoints(points) {
  return Math.floor(Math.max(0, Number(points) || 0) * 0.2);
}

export default function PawPointsCheckout({ orderCents = 0, items = [], sourceKey = "other", onChange }) {
  const [balance, setBalance] = useState({ available: 0, pending: 0 });
  const [want, setWant] = useState(0);
  const [quote, setQuote] = useState(null);

  function emit(points, extra = {}) {
    const pts = Math.floor(Math.max(0, Number(points) || 0));
    onChange?.({
      points: pts,
      cents: centsFromPoints(pts),
      earn: extra.earn ?? quote?.earn_points ?? 0,
    });
  }

  useEffect(() => {
    fetch("/api/paw-points/balance").then((r) => r.json()).then((d) => {
      if (d.available != null) setBalance(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/paw-points/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_cents: orderCents, points: want, items, source_key: sourceKey }),
        });
        const data = await res.json();
        setQuote(data);
        if (data.redeem?.ok) {
          emit(data.redeem.points, { earn: data.earn_points || 0 });
        } else if (want > 0) {
          emit(want, { earn: data.earn_points || 0 });
        }
      } catch {
        emit(want);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [want, orderCents, sourceKey]);

  return (
    <div className="rounded-2xl border border-[#e8d5c4] p-3 text-sm">
      <p className="font-medium">Paw Points</p>
      <p className="mt-1 text-xs text-[#7a5c4e]">Available {balance.available} · Pending {balance.pending}. Min 100. Max 40% of this order. 500 pts = $1.00.</p>
      {quote?.earn_points ? <p className="mt-1 text-xs text-green-700">Earn {quote.earn_points} points on the cash portion (after completion).</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min="0"
          className="w-28 rounded-lg border border-[#e8d5c4] px-2 py-1"
          value={want}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value) || 0);
            setWant(n);
            emit(n);
          }}
        />
        <button
          type="button"
          className="text-xs font-semibold text-[#c45c26]"
          onClick={() => {
            const n = Math.floor(Number(balance.available) || 0);
            setWant(n);
            emit(n);
          }}
        >
          Use max
        </button>
      </div>
      {want > 0 ? <p className="mt-1 text-xs text-[#3b2a22]">Will apply {want} pts (−${(centsFromPoints(want) / 100).toFixed(2)}) if valid.</p> : null}
      {quote?.redeem && !quote.redeem.ok && want > 0 ? <p className="mt-1 text-xs text-red-600">{quote.redeem.reason}</p> : null}
    </div>
  );
}
