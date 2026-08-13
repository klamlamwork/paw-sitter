// app/shop/checkout/CheckoutForm.js
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function CheckoutForm({ user, defaultAddress }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: defaultAddress?.name || '',
    email: defaultAddress?.email || user.email || '',
    phone: defaultAddress?.phone || '',
    line1: defaultAddress?.line1 || '',
    line2: defaultAddress?.line2 || '',
    city: defaultAddress?.city || '',
    state: defaultAddress?.state || '',
    postal_code: defaultAddress?.postal_code || '',
    country: defaultAddress?.country || 'US',
    label: defaultAddress?.label || '',
  });
  const [saveAddress, setSaveAddress] = useState(!defaultAddress);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (saveAddress) {
        await supabase.from('user_addresses').upsert({
          user_id: user.id,
          ...form,
          is_default: !defaultAddress,
        });
      }

      // TODO: create order here (next phase)
      alert('Order placed! (placeholder)');
      router.push('/account/shop');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2">
          <span className="block text-sm font-medium">Full name</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>

        <label className="col-span-2">
          <span className="block text-sm font-medium">Email</span>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>

        <label className="col-span-2">
          <span className="block text-sm font-medium">Phone</span>
          <input
            type="tel"
            className="w-full border rounded px-3 py-2"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 (555) 123‑4567"
          />
        </label>

        <label className="col-span-2">
          <span className="block text-sm font-medium">Address line 1</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.line1}
            onChange={e => setForm({ ...form, line1: e.target.value })}
            placeholder="123 Main St"
            required={!defaultAddress?.line1}
          />
        </label>

        <label className="col-span-2">
          <span className="block text-sm font-medium">Address line 2 (optional)</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.line2}
            onChange={e => setForm({ ...form, line2: e.target.value })}
            placeholder="Apt 4B"
          />
        </label>

        <label>
          <span className="block text-sm font-medium">City</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
            placeholder="San Francisco"
            required={!defaultAddress?.city}
          />
        </label>

        <label>
          <span className="block text-sm font-medium">State / Province</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.state}
            onChange={e => setForm({ ...form, state: e.target.value })}
            placeholder="CA"
            required={!defaultAddress?.state}
          />
        </label>

        <label>
          <span className="block text-sm font-medium">Postal code</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.postal_code}
            onChange={e => setForm({ ...form, postal_code: e.target.value })}
            placeholder="94107"
            required={!defaultAddress?.postal_code}
          />
        </label>

        <label>
          <span className="block text-sm font-medium">Country</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.country}
            onChange={e => setForm({ ...form, country: e.target.value })}
            placeholder="US"
            required
          />
        </label>

        <label className="col-span-2">
          <span className="block text-sm font-medium">Label (optional)</span>
          <input
            className="w-full border rounded px-3 py-2"
            value={form.label}
            onChange={e => setForm({ ...form, label: e.target.value })}
            placeholder="Home"
          />
        </label>

        <label className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={saveAddress}
            onChange={e => setSaveAddress(e.target.checked)}
          />
          <span className="text-sm">Save this address for future use</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white px-6 py-3 rounded disabled:opacity-50"
      >
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </form>
  );
}
