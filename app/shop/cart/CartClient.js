// app/shop/cart/CartClient.js
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CartClient({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function loadCart() {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product:shop_products!inner (
            id,
            name,
            image_url,
            brand:shop_brands ( name ),
            primary_shop:shops!inner ( id, name, type )
          ),
          offer:shop_product_offers!inner (
            id,
            shop:shops!inner ( id, name, type )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Cart load error:', error);
      } else {
        setItems(data || []);
      }
      setLoading(false);
    }

    loadCart();
  }, [user]);

  if (loading) return <p>Loading cart…</p>;
  if (!items.length) return <p>Your cart is empty.</p>;

  // Group by seller (offer.shop)
  const bySeller = items.reduce((acc, it) => {
    const seller = it.offer.shop;
    const key = `${seller.id}__${seller.name}`;
    if (!acc[key]) acc[key] = { seller, items: [] };
    acc[key].items.push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.values(bySeller).map(group => (
        <div key={group.seller.id} className="border rounded p-4">
          <h3 className="font-semibold text-lg mb-2">
            {group.seller.name} {group.seller.type === 'brand' ? '(Brand)' : '(Retailer)'}
          </h3>
          <ul className="divide-y">
            {group.items.map(it => (
              <li key={it.id} className="py-3 flex gap-4">
                <img
                  src={it.product.image_url || '/placeholder.png'}
                  alt={it.product.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{it.product.name}</div>
                  <div className="text-sm text-gray-600">
                    Qty: {it.quantity}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <button
        className="bg-black text-white px-6 py-3 rounded"
        onClick={() => (window.location.href = '/shop/checkout')}
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
