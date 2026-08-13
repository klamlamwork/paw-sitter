import Link from "next/link";
import ShopCartClient from "./CartClient";

export const metadata = {
  title: "Cart | Paw Sitter Shop",
  description: "Your Paw Sitter shop cart.",
};

export default function ShopCartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Continue shopping
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Cart</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Items are grouped by shop. Guests are saved in this browser; sign in to keep your cart.
      </p>
      <ShopCartClient />
    </div>
  );
}
