"use client";

import { useEffect, useState } from "react";
import PawPointsCheckout from "@/components/shop/PawPointsCheckout";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function CheckoutForm({ userId, cartId, items = [], subtotalCents = 0, defaultAddress }) {
  const [form, setForm] = useState({
    name: defaultAddress?.name || "",
    email: defaultAddress?.email || "",
    phone: defaultAddress?.phone || "",
    line1: defaultAddress?.line1 || "",
    line2: defaultAddress?.line2 || "",
    city: defaultAddress?.city || "",
    state: defaultAddress?.state || "",
    postal_code: defaultAddress?.postal_code || "",
    country: defaultAddress?.country || "Canada",
    payment_method: "card",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const [promoCode, setPromoCode] = useState(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [shopMethods, setShopMethods] = useState({});
  const [shippingQuotes, setShippingQuotes] = useState([]);
  const [totalShippingCents, setTotalShippingCents] = useState(0);
  const [paw, setPaw] = useState({ points: 0, cents: 0, earn: 0 });

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    const initial = {};
    for (const it of items || []) {
      if (it.shop_id) initial[it.shop_id] = initial[it.shop_id] || "standard";
    }
    setShopMethods(initial);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    async function runQuote() {
      if (!items?.length || !form.city || !form.state || !form.country) {
        setShippingQuotes([]);
        setTotalShippingCents(0);
        return;
      }
      const res = await fetch("/api/shop/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: form, selections: shopMethods }),
      });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Could not quote shipping");
        return;
      }
      setShippingQuotes(data.quotes || []);
      setTotalShippingCents(data.totalShippingCents || 0);
    }
    runQuote();
    return () => { cancelled = true; };
  }, [form.line1, form.city, form.state, form.country, shopMethods, items]);

  async function applyPromo() {
    setError("");
    setPromoApplying(true);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo, context: "shop" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not apply promo");
      setPromoCode(data.code);
    } catch (err) {
      setPromoCode(null);
      setError(err.message);
    } finally {
      setPromoApplying(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (!userId) throw new Error("Sign in to place an order.");
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form,
          promo_code: promoCode?.code || null,
          shipping_selections: shopMethods,
          paw_points: paw.points || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not place orders");
      setSubmitting(false);
    }
  }

  const discount = promoCode?.discount_cents || 0;
  const total = Math.max(0, (subtotalCents || 0) - discount - (paw.cents || 0) + totalShippingCents);
  const earnItems = (items || []).map((i) => ({ net_cents: (i.price_cents || 0) * (i.qty || 1), product_type: i.product?.product_type || "other", qty: 1 }));

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
        <p className="font-semibold">Order summary</p>
        <div className="mt-3 space-y-1 border-t border-[#e8d5c4] pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
          {discount ? <div className="flex justify-between text-green-700"><span>Promo</span><span>-{money(discount)}</span></div> : null}
          {paw.cents ? <div className="flex justify-between text-green-700"><span>Paw Points</span><span>-{money(paw.cents)}</span></div> : null}
          <div className="flex justify-between"><span>Shipping</span><span>{money(totalShippingCents)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{money(total)}</span></div>
        </div>
        {paw.earn ? <p className="mt-2 text-xs text-green-700">Earn {paw.earn} Paw Points on the cash portion (after delivery).</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">Name<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
        <label className="text-sm">Email<input type="email" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.email} onChange={(e) => setField("email", e.target.value)} /></label>
        <label className="text-sm">Phone<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
        <label className="text-sm">Postal code<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} /></label>
      </div>
      <label className="block text-sm">Address line 1<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.line1} onChange={(e) => setField("line1", e.target.value)} /></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">City<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.city} onChange={(e) => setField("city", e.target.value)} /></label>
        <label className="text-sm">Province<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.state} onChange={(e) => setField("state", e.target.value)} /></label>
        <label className="text-sm">Country<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.country} onChange={(e) => setField("country", e.target.value)} /></label>
      </div>
      <div className="rounded-2xl border border-[#e8d5c4] p-3">
        <p className="text-sm font-medium">Promo code</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="w-40 rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm" value={promo} onChange={(e) => setPromo(e.target.value)} />
          <button type="button" disabled={promoApplying} onClick={applyPromo} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold">{promoApplying ? "…" : "Apply"}</button>
        </div>
      </div>
      <PawPointsCheckout orderCents={Math.max(0, subtotalCents - discount)} items={earnItems} onChange={setPaw} />
      <div className="rounded-2xl border border-[#e8d5c4] p-3">
        <p className="text-sm font-medium">Shipping method (per shop)</p>
        <div className="mt-2 space-y-2">
          {Object.entries(shopMethods).map(([shopId, method]) => {
            const quote = shippingQuotes.find((q) => q.shopId === shopId);
            return (
              <div key={shopId} className="flex items-center justify-between gap-2 rounded-xl border border-[#e8d5c4] p-2 text-sm">
                <span>{quote?.label || "Standard"} {quote?.cents != null ? `(${money(quote.cents)})` : ""}</span>
                <select className="rounded-lg border border-[#e8d5c4] px-2 py-1" value={method} onChange={(e) => setShopMethods((m) => ({ ...m, [shopId]: e.target.value }))}>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
      <button type="submit" disabled={submitting || !items.length} className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? "Working…" : `Pay ${money(total)}`}
      </button>
    </form>
  );
}
