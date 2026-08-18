"use client";

import { useEffect, useState } from "react";

export default function PawPointsCheckout({ orderCents = 0, items = [], sourceKey = "other", onChange }) {
  const [balance, setBalance] = useState({ available: 0, pending: 0 });
  const [want, setWant] = useState(0);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    fetch("/api/paw-points/balance").then((r) => r.json()).then((d) => {
      if (d.available != null) setBalance(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch("/api/paw-points/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_cents: orderCents, points: want, items, source_key: sourceKey }),
      });
      const data = await res.json();
      setQuote(data);
      onChange?.({ points: data.redeem?.ok ? data.redeem.points : 0, cents: data.redeem?.ok ? data.redeem.cents : 0, earn: data.earn_points || 0 });
    }, 250);
    return () => clearTimeout(t);
  }, [want, orderCents, sourceKey]);

  return (
    <div className="rounded-2xl border border-[#e8d5c4] p-3 text-sm">
      <p className="font-medium">Paw Points</p>
      <p className="mt-1 text-xs text-[#7a5c4e]">Available {balance.available} · Pending {balance.pending}. Min 100. Max 40% of this order.</p>
      {quote?.earn_points ? <p className="mt-1 text-xs text-green-700">Earn {quote.earn_points} points on the cash portion (after completion).</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <input type="number" min="0" className="w-28 rounded-lg border border-[#e8d5c4] px-2 py-1" value={want} onChange={(e) => setWant(Number(e.target.value) || 0)} />
        <button type="button" className="text-xs font-semibold text-[#c45c26]" onClick={() => setWant(balance.available)}>Use max</button>
      </div>
      {quote?.redeem && !quote.redeem.ok && want > 0 ? <p className="mt-1 text-xs text-red-600">{quote.redeem.reason}</p> : null}
      {quote?.redeem?.ok ? <p className="mt-1 text-xs text-green-700">Apply {quote.redeem.points} pts (−${(quote.redeem.cents / 100).toFixed(2)})</p> : null}
    </div>
  );
}
