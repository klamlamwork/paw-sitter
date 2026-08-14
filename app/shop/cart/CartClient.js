"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatShopPrice } from "@/lib/shop";
import {
  cartSubtotalCents,
  loadUserCartItems,
  readGuestCart,
  removeUserCartItem,
  setUserCartQty,
  writeGuestCart,
} from "@/lib/shopCart";

export default function ShopCartClient() {
  const [items, setItems] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload(uid) {
    setError("");
    try {
      if (uid) {
        const supabase = createClient();
        const rows = await loadUserCartItems(supabase, uid);
        setItems(rows);
      } else {
        setItems(readGuestCart().items || []);
      }
    } catch (e) {
      setError(e.message || "Could not load cart");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      if (cancelled) return;
      setUserId(uid);
      await reload(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const i of items) {
      const key = i.shop_id || i.shop_slug || i.shop_name || "shop";
      if (!map.has(key)) {
        map.set(key, {
          shop_id: key,
          shop_name: i.shop_name || "Shop",
          shop_slug: i.shop_slug || "",
          items: [],
        });
      }
      map.get(key).items.push(i);
    }
    return [...map.values()];
  }, [items]);

  const subtotal = cartSubtotalCents(items);

  async function changeQty(item, qty) {
    try {
      if (userId) {
        const supabase = createClient();
        await setUserCartQty(supabase, item.id, qty);
        await reload(userId);
      } else {
        const next = (readGuestCart().items || [])
          .map((i) => (sameLine(i, item) ? { ...i, qty } : i))
          .filter((i) => i.qty > 0);
        writeGuestCart({ items: next });
        setItems(next);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(item) {
    try {
      if (userId) {
        const supabase = createClient();
        await removeUserCartItem(supabase, item.id);
        await reload(userId);
      } else {
        const next = (readGuestCart().items || []).filter((i) => !sameLine(i, item));
        writeGuestCart({ items: next });
        setItems(next);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[#7a5c4e]">Loading cart…</p>;

  return (
    <div className="mt-8 space-y-6">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!items.length ? (
        <p className="text-sm text-[#7a5c4e]">
          Your cart is empty.{" "}
          <Link href="/shop" className="font-semibold text-[#c45c26] hover:underline">
            Browse the shop
          </Link>
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.shop_id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#3b2a22]">
            <SellerName name={g.shop_name} slug={g.shop_slug} />
          </h2>
          <ul className="mt-3 divide-y divide-[#f0e4d8]">
            {g.items.map((i) => (
              <li key={i.id || lineKey(i)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={i.slug ? `/shop/p/${i.slug}` : "/shop"} className="font-semibold text-[#3b2a22] hover:text-[#c45c26]">
                    {i.name}
                  </Link>
                  {i.variant_name ? (
                    <p className="text-xs text-[#7a5c4e]">{i.variant_name}</p>
                  ) : null}
                  <p className="text-xs font-semibold text-[#c45c26]">
                    {formatShopPrice(i.price_cents, i.currency) || "\u2014"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-[#e8d5c4]"
                    onClick={() => changeQty(i, (i.qty || 1) - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-[#e8d5c4]"
                    onClick={() => changeQty(i, (i.qty || 1) + 1)}
                  >
                    +
                  </button>
                  <button type="button" className="text-xs font-semibold text-red-600" onClick={() => remove(i)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {items.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold text-[#3b2a22]">
            Subtotal {formatShopPrice(subtotal, "CAD")}
          </p>
          <Link
            href="/shop/checkout"
            className="rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Checkout
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SellerName({ name, slug }) {
  const label = name || "Shop";
  if (!slug) return <span>{label}</span>;
  return (
    <Link href={`/shop/shops/${slug}`} className="font-semibold text-[#c45c26] hover:underline">
      {label}
    </Link>
  );
}

function sameLine(a, b) {
  return (
    a.product_id === b.product_id &&
    (a.variant_id || null) === (b.variant_id || null) &&
    a.shop_id === b.shop_id
  );
}

function lineKey(i) {
  return `${i.product_id}::${i.variant_id || "none"}::${i.shop_id}`;
}
