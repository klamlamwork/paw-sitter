import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "./CheckoutForm";

export const metadata = { title: "Checkout | Paw Sitter" };

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/checkout");
  const { data: profile } = await supabase.from("profiles").select("default_address").eq("id", user.id).maybeSingle();
  const { data: saved } = await supabase.from("shop_addresses").select("*").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  const defaultAddress = saved || profile?.default_address || null;
  const { data: cartItems } = await supabase.from("shop_cart_items").select("id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(name)").eq("cart_id", user.id);
  const subtotal = (cartItems || []).reduce((sum, i) => sum + (i.price_cents || 0) * (i.qty || 1), 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Checkout</h1>
      <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
        <p className="font-semibold">Order summary</p>
        <div className="mt-2 flex items-center justify-between">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-[#7a5c4e]">Shipping and taxes calculated after payment method.</p>
      </div>
      <CheckoutForm userId={user.id} defaultAddress={defaultAddress} hasSavedAddress={!!saved} />
    </div>
  );
}
