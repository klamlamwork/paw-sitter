"use client";

import { useEffect, useMemo, useState } from "react";
import PawPointsCheckout from "@/components/shop/PawPointsCheckout";
import LocationPicker from "@/components/LocationPicker";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { inferProvinceFromPostal } from "@/lib/shopShipping";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function quoteAddress(form) {
  const state = form.state || inferProvinceFromPostal(form.postal_code, form.country);
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    line1: form.address_line1,
    line2: form.address_line2,
    address_line1: form.address_line1,
    address_line2: form.address_line2,
    city: form.city,
    state,
    province_state: state,
    postal_code: form.postal_code,
    country: form.country,
    country_code: form.country_code,
  };
}

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Could not apply promo. Refresh and try again.");
  }
}

export default function CheckoutForm({ userId, items = [], subtotalCents = 0, defaultAddress }) {
  const [form, setForm] = useState({
    name: defaultAddress?.name || "",
    email: defaultAddress?.email || "",
    phone: defaultAddress?.phone || "",
    location_id: defaultAddress?.location_id || "",
    address_line1: defaultAddress?.address_line1 || "",
    address_line2: defaultAddress?.address_line2 || "",
    city: defaultAddress?.city || "",
    state: inferProvinceFromPostal(defaultAddress?.postal_code, defaultAddress?.country),
    postal_code: defaultAddress?.postal_code || "",
    country: defaultAddress?.country || "Canada",
    country_code: defaultAddress?.country_code || "CA",
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

  const allPickup = useMemo(
    () => Object.keys(shopMethods).length > 0 && Object.values(shopMethods).every((method) => method === "pickup"),
    [shopMethods]
  );

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "postal_code" || key === "country") {
        next.state = inferProvinceFromPostal(next.postal_code, next.country);
      }
      return next;
    });
  }

  useEffect(() => {
    const initial = {};
    for (const item of items || []) {
      if (item.shop_id) initial[item.shop_id] = initial[item.shop_id] || "standard";
    }
    setShopMethods(initial);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    async function runQuote() {
      if (!items?.length) {
        setShippingQuotes([]);
        setTotalShippingCents(0);
        return;
      }
      if (!allPickup && (!form.city || !form.country || !(form.state || form.postal_code))) {
        setShippingQuotes([]);
        setTotalShippingCents(0);
        return;
      }
      const res = await fetch("/api/shop/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: quoteAddress(form), selections: shopMethods }),
      });
      const data = await readJson(res);
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Could not quote shipping");
        return;
      }
      setError("");
      setShippingQuotes(data.quotes || []);
      setTotalShippingCents(data.totalShippingCents || 0);
    }
    runQuote().catch((err) => {
      if (!cancelled) setError(err.message || "Could not quote shipping");
    });
    return () => {
      cancelled = true;
    };
  }, [items, form.city, form.country, form.state, form.postal_code, shopMethods, allPickup]);

  async function applyPromo() {
    setPromoApplying(true);
    setError("");
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo, context: "shop" }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not apply promo");
      setPromoCode(data.code);
    } catch (err) {
      setPromoCode(null);
      setError(err.message);
    } finally {
      setPromoApplying(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (!userId) throw new Error("Sign in to place an order.");
      if (!allPickup) {
        if (!form.city || !form.country) throw new Error("Choose your city and country.");
        if (!form.address_line1.trim()) throw new Error("Street address is required unless you pick pickup.");
        if (!form.postal_code.trim()) throw new Error("Postal code is required unless you pick pickup.");
      }
      if ((shippingQuotes || []).some((quote) => quote.blocked)) {
        throw new Error("One or more shops cannot ship to this address.");
      }
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: quoteAddress(form),
          promo_code: promoCode?.code || null,
          shipping_selections: shopMethods,
          paw_points: paw.points || 0,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not place orders");
      setSubmitting(false);
    }
  }

  const discount = promoCode?.discount_cents || 0;
  const total = Math.max(0, (subtotalCents || 0) - discount - (paw.cents || 0) + totalShippingCents);
  const earnItems = (items || []).map((item) => ({
    net_cents: (item.price_cents || 0) * (item.qty || 1),
    product_type: item.product?.product_type || "other",
    qty: 1,
  }));

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
        <label className="text-sm">Name<input required className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
        <label className="text-sm">Email<input required type="email" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.email} onChange={(e) => setField("email", e.target.value)} /></label>
        <label className="text-sm">Phone<input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
      </div>

      {!allPickup ? (
        <div className="space-y-4 rounded-2xl border border-[#e8d5c4] bg-white p-4">
          <LocationPicker
            valueId={form.location_id}
            onChange={(loc) => {
              if (!loc) {
                setForm((current) => ({
                  ...current,
                  location_id: "",
                  city: "",
                  country: "",
                  country_code: "",
                  address_line1: "",
                  address_line2: "",
                  postal_code: "",
                  state: "",
                }));
                return;
              }
              setForm((current) => ({
                ...current,
                location_id: loc.location_id,
                city: loc.city,
                country: loc.country,
                country_code: loc.country_code,
                address_line1: "",
                address_line2: "",
                postal_code: "",
                state: "",
              }));
            }}
          />
          <AddressAutocomplete
            countryCode={form.country_code}
            cityName={form.city}
            label="Street address"
            value={{
              address_line1: form.address_line1,
              address_line2: form.address_line2,
              postal_code: form.postal_code,
            }}
            onChange={(addr) => {
              setForm((current) => {
                const postal = addr.postal_code || current.postal_code;
                return {
                  ...current,
                  address_line1: addr.address_line1 || "",
                  address_line2: addr.address_line2 ?? current.address_line2,
                  postal_code: postal,
                  state: inferProvinceFromPostal(postal, current.country),
                };
              });
            }}
          />
          <p className="text-xs text-[#7a5c4e]">Apt / unit stays optional. Street, city, country, and postal code are required for delivery.</p>
        </div>
      ) : (
        <p className="text-sm text-[#7a5c4e]">Pickup selected for every shop — delivery address is not required.</p>
      )}

      <div className="rounded-2xl border border-[#e8d5c4] p-3">
        <p className="text-sm font-medium">Promo code</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input placeholder="Enter code" className="w-40 rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm" value={promo} onChange={(e) => setPromo(e.target.value)} />
          <button type="button" disabled={promoApplying || !items.length} onClick={applyPromo} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60">{promoApplying ? "Checking…" : "Apply"}</button>
          {promoCode ? <span className="text-xs text-green-700">Applied: {promoCode.label || promoCode.code} (-{money(promoCode.discount_cents)})</span> : null}
        </div>
      </div>

      <PawPointsCheckout orderCents={Math.max(0, subtotalCents - discount)} items={earnItems} onChange={setPaw} />

      <div className="rounded-2xl border border-[#e8d5c4] p-3">
        <p className="text-sm font-medium">Shipping method (per shop)</p>
        <div className="mt-2 space-y-2">
          {Object.entries(shopMethods).map(([shopId, method]) => {
            const quote = shippingQuotes.find((row) => row.shopId === shopId);
            return (
              <div key={shopId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e8d5c4] p-2 text-sm">
                <div>
                  <p className="font-semibold">{quote?.label || "Standard"} {quote?.cents != null ? `(${money(quote.cents)})` : ""}</p>
                  {quote?.blocked ? <p className="text-xs text-red-600">{quote.reason || "Unavailable for this address."}</p> : null}
                </div>
                <select className="rounded-lg border border-[#e8d5c4] px-2 py-1" value={method} onChange={(e) => setShopMethods((current) => ({ ...current, [shopId]: e.target.value }))}>
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
