import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/discounts";

export const metadata = { title: "Shop Payouts | Paw Sitter" };

export default async function ShopPayoutsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/shop/payouts");
  const { data: shop } = await supabase.from("shop_shops").select("id, owner_profile_id").eq("owner_profile_id", user.id).maybeSingle();
  if (!shop) redirect("/account/shop");
  const admin = supabase;
  const { data: ledger } = await admin.from("discount_ledger").select("*").eq("vendor_type", "shop").eq("vendor_id", shop.id).order("created_at", { ascending: false }).limit(100);
  const platformAbsorbed = (ledger || []).reduce((sum, row) => sum + (row.platform_absorbed_cents || 0), 0);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Shop Payouts</h1>
      <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] p-4 text-sm">
        <p className="font-semibold">Platform-funded promo cost</p>
        <p className="mt-1 text-[#7a5c4e]">This is the total discount the platform absorbed on your orders (reduces our fee, not your payout).</p>
        <p className="mt-2 text-lg font-bold text-[#3b2a22]">{money(platformAbsorbed)}</p>
      </div>
      <h2 className="mt-6 text-lg font-semibold text-[#3b2a22]">Recent ledger</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {(ledger || []).slice(0, 20).map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-xl border border-[#e8d5c4] bg-white p-3">
            <div>
              <p className="font-semibold">{row.code_id}</p>
              <p className="text-xs text-[#7a5c4e]">Gross {money(row.gross_cents)} • Discount {money(row.discount_cents)} • Platform absorbed {money(row.platform_absorbed_cents)}</p>
            </div>
            <span className="text-xs text-[#7a5c4e]">{new Date(row.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
