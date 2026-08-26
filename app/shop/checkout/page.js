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
  const { data: items } = await supabase
    .from("shop_cart_items")
    .select("id, product_id, variant_id, shop_id, qty, price_cents, currency, product:shop_products(name, product_type)")
    .eq("cart_id", cartId);
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, location_id, address_line1, address_line2, city, country, postal_code, country_code")
    .eq("id", user.id)
    .maybeSingle();

  const subtotalCents = (items || []).reduce(
    (sum, item) => sum + (Number(item.price_cents) || 0) * (Number(item.qty) || 1),
    0
  );
  const defaultAddress = {
    name: profile?.full_name || "",
    email: profile?.email || user.email || "",
    phone: "",
    location_id: profile?.location_id || "",
    address_line1: profile?.address_line1 || "",
    address_line2: profile?.address_line2 || "",
    city: profile?.city || "",
    postal_code: profile?.postal_code || "",
    country: profile?.country || "Canada",
    country_code: profile?.country_code || "CA",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Checkout</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Address fields match your account. Street address is required unless you pick pickup.</p>
      <CheckoutForm
        userId={user.id}
        cartId={cartId}
        items={items || []}
        subtotalCents={subtotalCents}
        defaultAddress={defaultAddress}
      />
    </div>
  );
}
