import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserCart } from "@/lib/shopCart";
import CheckoutForm from "./CheckoutForm";

export const metadata = { title: "Checkout | Paw Sitter" };

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop/checkout");

  const cartId = await ensureUserCart(supabase, user.id);
  const { data: cartItems } = await supabase
    .from("shop_cart_items")
    .select("id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(name)")
    .eq("cart_id", cartId);

  const items = cartItems || [];
  const subtotal = items.reduce((sum, i) => sum + (i.price_cents || 0) * (i.qty || 1), 0);

  const { data: profile } = await supabase.from("profiles").select("default_address").eq("id", user.id).maybeSingle();
  const { data: saved } = await supabase.from("shop_addresses").select("*").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  const defaultAddress = saved || profile?.default_address || null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Checkout</h1>
      <CheckoutForm
        userId={user.id}
        cartId={cartId}
        items={items}
        subtotalCents={subtotal}
        defaultAddress={defaultAddress}
        hasSavedAddress={!!saved}
      />
    </div>
  );
}
