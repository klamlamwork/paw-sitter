import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "./CheckoutForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout | Paw Sitter Shop",
  description: "Shipping details for your Paw Sitter shop order.",
};

export default async function CheckoutPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/checkout");

  const supabase = await createClient();
  const { data: address } = await supabase
    .from("user_addresses")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_default", true)
    .maybeSingle();

  const defaultAddress = {
    name: address?.name || profile.full_name || "",
    email: address?.email || profile.email || "",
    phone: address?.phone || "",
    line1: address?.line1 || "",
    line2: address?.line2 || "",
    city: address?.city || profile.city || "",
    state: address?.state || "",
    postal_code: address?.postal_code || "",
    country: address?.country || profile.country || "Canada",
    label: address?.label || "",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/shop/cart" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; Back to cart
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Checkout</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">
        Confirm shipping details. Payment is next.
      </p>
      <CheckoutForm
        userId={profile.id}
        defaultAddress={defaultAddress}
        hasSavedAddress={Boolean(address)}
      />
    </div>
  );
}
