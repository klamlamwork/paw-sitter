"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  addUserCartItem,
  mergeLine,
  readGuestCart,
  writeGuestCart,
} from "@/lib/shopCart";

export default function AddToCartButton({ line, disabled, label = "Add to cart" }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (disabled || !line?.product_id || !line?.shop_id) return;
    setBusy(true);
    setError("");
    setOk(false);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (userId) {
        await addUserCartItem(supabase, userId, line);
      } else {
        const cart = readGuestCart();
        writeGuestCart({ items: mergeLine(cart.items, { ...line, id: lineKey(line) }) });
      }
      setOk(true);
    } catch (e) {
      setError(e.message || "Could not add to cart");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={add}
        className="inline-flex rounded-full bg-[#c45c26] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Adding…" : ok ? "Added" : label}
      </button>
      {ok ? (
        <p className="text-xs">
          <Link href="/shop/cart" className="font-semibold text-[#c45c26] hover:underline">
            View cart →
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function lineKey(line) {
  return `${line.product_id}::${line.variant_id || "none"}::${line.shop_id}`;
}
