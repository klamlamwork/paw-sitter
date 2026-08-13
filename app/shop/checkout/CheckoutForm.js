"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserCart } from "@/lib/shopCart";

export default function CheckoutForm({ userId, defaultAddress, hasSavedAddress }) {
  const router = useRouter();
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
    payment_method: "etransfer",
  });
  const [saveAddress, setSaveAddress] = useState(!hasSavedAddress);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const supabase = createClient();

      if (saveAddress && userId) {
        const { name, email, phone, line1, line2, city, state, postal_code, country, label } = form;
        const { error: addrErr } = await supabase.from("user_addresses").insert({
          user_id: userId,
          name,
          email,
          phone,
          line1,
          line2,
          city,
          state,
          postal_code,
          country,
          label,
          is_default: !hasSavedAddress,
        });
        if (addrErr) throw addrErr;
      }

      if (!userId) throw new Error("You must be signed in to place an order.");

      const cartId = await ensureUserCart(supabase, userId);
      const { data: cartItems, error: cartErr } = await supabase
        .from("shop_cart_items")
        .select("id, product_id, variant_id, shop_id, qty, price_cents, currency")
        .eq("cart_id", cartId);

      if (cartErr) throw cartErr;
      if (!cartItems?.length) throw new Error("Your cart is empty.");

      const bySeller = new Map();
      for (const item of cartItems) {
        if (!item.shop_id) continue;
        if (!bySeller.has(item.shop_id)) bySeller.set(item.shop_id, []);
        bySeller.get(item.shop_id).push(item);
      }
      if (!bySeller.size) throw new Error("No valid seller found for items in cart.");

      const paymentStatus = form.payment_method === "pickup" ? "unpaid" : "pending";

      for (const [sellerShopId, items] of bySeller.entries()) {
        const { data: order, error: orderErr } = await supabase
          .from("shop_orders")
          .insert({
            user_id: userId,
            seller_shop_id: sellerShopId,
            status: "pending",
            payment_method: form.payment_method,
            payment_status: paymentStatus,
            shipping_name: form.name,
            shipping_email: form.email,
            shipping_phone: form.phone,
            shipping_line1: form.line1,
            shipping_line2: form.line2,
            shipping_city: form.city,
            shipping_state: form.state,
            shipping_postal_code: form.postal_code,
            shipping_country: form.country,
          })
          .select("id")
          .single();
        if (orderErr) throw orderErr;

        const { error: itemsErr } = await supabase.from("shop_order_items").insert(
          items.map((i) => ({
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

      const { error: clearErr } = await supabase.from("shop_cart_items").delete().eq("cart_id", cartId);
      if (clearErr) throw clearErr;

      router.push("/shop/orders?placed=1");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not place order");
      setSubmitting(false);
    }
  }

  const fieldClass = "mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <label className="block text-sm">
        Full name
        <input className={fieldClass} value={form.name} onChange={(e) => setField("name", e.target.value)} required />
      </label>
      <label className="block text-sm">
        Email
        <input type="email" className={fieldClass} value={form.email} onChange={(e) => setField("email", e.target.value)} required />
      </label>
      <label className="block text-sm">
        Phone
        <input type="tel" className={fieldClass} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(555) 123-4567" />
      </label>
      <label className="block text-sm">
        Street address
        <input className={fieldClass} value={form.line1} onChange={(e) => setField("line1", e.target.value)} placeholder="123 Main St" required={!defaultAddress?.line1} />
      </label>
      <label className="block text-sm">
        Apt / suite (optional)
        <input className={fieldClass} value={form.line2} onChange={(e) => setField("line2", e.target.value)} placeholder="Apt 4B" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          City
          <input className={fieldClass} value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Toronto" required={!defaultAddress?.city} />
        </label>
        <label className="block text-sm">
          Province / state
          <input className={fieldClass} value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="ON" />
        </label>
        <label className="block text-sm">
          Postal code
          <input className={fieldClass} value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} placeholder="M5V 2T6" />
        </label>
        <label className="block text-sm">
          Country
          <input className={fieldClass} value={form.country} onChange={(e) => setField("country", e.target.value)} required />
        </label>
      </div>
      <label className="block text-sm">
        Address label (optional)
        <input className={fieldClass} value={form.label} onChange={(e) => setField("label", e.target.value)} placeholder="Home" />
      </label>
      <fieldset className="rounded-2xl border border-[#e8d5c4] p-3">
        <legend className="px-1 text-sm font-medium">How will you pay?</legend>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "etransfer"} onChange={() => setField("payment_method", "etransfer")} />
          <span>Interac e-Transfer (seller confirms when received)</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "pickup"} onChange={() => setField("payment_method", "pickup")} />
          <span>Pay at pickup</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" name="payment_method" checked={form.payment_method === "later"} onChange={() => setField("payment_method", "later")} />
          <span>Pay later (card checkout comes next)</span>
        </label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
        Save this address for future use
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Placing orders…" : "Place orders"}
      </button>
    </form>
  );
}
