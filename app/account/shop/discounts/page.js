import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiscountsClient from "../DiscountsClient";

export const metadata = { title: "Shop Discounts | Paw Sitter" };

export default async function ShopDiscountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/shop/discounts");
  const { data: shop } = await supabase.from("shop_shops").select("id").eq("owner_profile_id", user.id).maybeSingle();
  if (!shop) redirect("/account/shop");
  const { data: codes } = await supabase.from("discount_codes").select("*").eq("vendor_shop_id", shop.id).order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Shop Discounts</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Create promos for your own shop orders. Discounts reduce your payout.</p>
      <DiscountsClient initial={codes || []} shopId={shop.id} />
    </div>
  );
}
