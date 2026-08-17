"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureUserCart } from "@/lib/shopCart";

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export default function CheckoutForm({
  userId,
  cartId,
  items = [],
  subtotalCents = 0,
  defaultAddress,
  hasSavedAddress,
}) {
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
    label: defaultAddress?.label || "",
    payment_method: "card",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const [promoCode, setPromoCode] = useState(null);
  const [promoApplying, setPromoApplying] = useState(false);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

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
      if (!data.discount_cents) throw new Error("This promo did not reduce the cart total.");
      setPromoCode(data.code);
    } catch (err) {
      setPromoCode(null);
      setError(err.message || "Could not apply promo");
    } finally {
      setPromoApplying(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (!userId) throw new Error("You must be signed in to place an order.");

      if (form.payment_method === "card") {
        const res = await fetch("/api/shop/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: form, promo_code: promoCode?.code || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start card checkout");
        window.location.href = data.url;
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const resolvedCartId = cartId || (await ensureUserCart(supabase, userId));
      const { data: cartItems, error: cartErr } = await supabase
        .from("shop_cart_items")
        .select("id, product_id, variant_id, shop_id, qty, price_cents, currency")
        .eq("cart_id", resolvedCartId);
      if (cartErr) throw cartErr;
      if (!cartItems?.length) throw new Error("Your cart is empty.");

      const bySeller = new Map();
      for (const item of cartItems) {
        if (!item.shop_id) continue;
        if (!bySeller.has(item.shop_id)) bySeller.set(item.shop_id, []);
        bySeller.get(item.shop_id).push(item);
      }
      if (!bySeller.size) throw new Error("No valid seller in cart.");

      for (const [sellerShopId, sellerItems] of bySeller.entries()) {
        const { data: order, error: orderErr } = await supabase
          .from("shop_orders")
          .insert({
            user_id: user.id,
            seller_shop_id: sellerShopId,
            status: "pending",
            payment_method: form.payment_method,
            payment_status: "pending",
            shipping_name: form.name || "",
            shipping_email: form.email || user.email || "",
            shipping_phone: form.phone || "",
            shipping_line1: form.line1 || "",
            shipping_line2: form.line2 || "",
            shipping_city: form.city || "",
            shipping_state: form.state || "",
            shipping_postal_code: form.postal_code || "",
            shipping_country: form.country || "Canada",
            discount_code: promoCode?.code || null,
            discount_code_id: promoCode?.id || null,
            discount_cents: promoCode?.discount_cents || 0,
            discount_funded_by: promoCode?.funded_by_platform ? "platform" : promoCode ? "vendor" : null,
          })
          .select("id")
          .single();
        if (orderErr) throw orderErr;
        const { error: itemsErr } = await supabase.from("shop_order_items").insert(
          sellerItems.map((i) => ({
            order_id: order.id,
            product_id: i.product_id,
            variant_id: i.variant_id || null,
            seller_shop_id: sellerShopId,
            qty: i.qty,
            price_cents: i.price_cents,
            currency: i.currency || "CAD",
          }))
        );
        if (itemsErr) throw itemsErr;
      }

      await supabase.from("shop_cart_items").delete().eq("cart_id", resolvedCartId);
      window.location.href = "/shop/orders?placed=1";
    } catch (err) {
      setError(err.message || "Could not place orders");
      setSubmitting(false);
    }
  }

  const discount = promoCode?.discount_cents || 0;
  const total = Math.max(0, (subtotalCents || 0) - discount);

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
        <p className="font-semibold">Order summary</p>
        {items.length === 0 ? (
          <p className="mt-2 text-[#7a5c4e]">Your cart is empty.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>
                  {item.product?.name || "Shop item"} × {item.qty || 1}
                </span>
                <span>{money((item.price_cents || 0) * (item.qty || 1))}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-1 border-t border-[#e8d5c4] pt-2">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{money(subtotalCents)}</span>
          </div>
          {discount ? (
            <div className="flex items-center justify-between text-green-700">
              <span>Discount ({promoCode.code})</span>
              <span>-{money(discount)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Name
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.name} onChange={(e) => setField("name", e.target.value)} />
        </label>
        <label className="text-sm">
          Email
          <input type="email" className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.email} onChange={(e) => setField("email", e.target.value)} />
        </label>
        <label className="text-sm">
          Phone
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
        </label>
        <label className="text-sm">
          Postal code
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        Address line 1
        <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.line1} onChange={(e) => setField("line1", e.target.value)} />
      </label>
      <label className="block text-sm">
        Address line 2
        <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.line2} onChange={(e) => setField("line2", e.target.value)} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          City
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.city} onChange={(e) => setField("city", e.target.value)} />
        </label>
        <label className="text-sm">
          State/Province
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.state} onChange={(e) => setField("state", e.target.value)} />
        </label>
        <label className="text-sm">
          Country
          <input className="mt-1 w-full rounded-lg border border-[#e8d5c4] px-2 py-1" value={form.country} onChange={(e) => setField("country", e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-[#e8d5c4] p-3">
        <p className="text-sm font-medium">Promo code</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            placeholder="Enter code"
            className="w-40 rounded-lg border border-[#e8d5c4] px-2 py-1 text-sm"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <button type="button" disabled={promoApplying || !items.length} onClick={applyPromo} className="rounded-full border border-[#e8d5c4] px-3 py-1 text-xs font-semibold disabled:opacity-60">
            {promoApplying ? "Checking…" : "Apply"}
          </button>
          {promoCode ? (
            <span className="text-xs text-green-700">
              Applied: {promoCode.label} (-{money(promoCode.discount_cents)})
            </span>
          ) : null}
        </div>
      </div>

      <fieldset className="rounded-2xl border border-[#e8d5c4] p-3">
        <legend className="px-1 text-sm font-medium">How will you pay?</legend>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "card"} onChange={() => setField("payment_method", "card")} />
          <span>Card (Stripe)</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "etransfer"} onChange={() => setField("payment_method", "etransfer")} />
          <span>Interac e-Transfer (seller confirms when received)</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "later"} onChange={() => setField("payment_method", "later")} />
          <span>Pay later</span>
        </label>
      </fieldset>

      <button type="submit" disabled={submitting || !items.length} className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? "Working…" : form.payment_method === "card" ? `Pay ${money(total)}` : "Place orders"}
      </button>
    </form>
  );
}
