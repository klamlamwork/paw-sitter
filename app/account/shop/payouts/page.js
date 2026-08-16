import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectStatus } from "@/lib/stripeConnect";
import PayoutConnectButton from "@/components/PayoutConnectButton";

export const metadata = { title: "Shop payouts | Paw Sitter" };

export default async function ShopPayoutsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account/shop/payouts");
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shop_shops").select("id, name").eq("owner_profile_id", profile.id).order("created_at").limit(1).maybeSingle();
  if (!shop) redirect("/account/shop");
  const status = await connectStatus({ kind: "shop", shopId: shop.id });
  const admin = createAdminClient();
  const { data: entries } = await admin.from("escrow_entries").select("*").eq("provider_type", "shop").eq("provider_id", shop.id).order("created_at", { ascending: false }).limit(30);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/account/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop portal</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop payouts</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Connect your shop bank account. Paid orders stay in Stripe escrow and release 14 days after you mark them delivered. Payouts are sent weekly.</p>
      <div className="mt-6 rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <p className="text-sm">{shop.name}: <strong>{status.payouts_enabled ? "Ready for payouts" : status.connected ? "Finish bank setup" : "Not connected"}</strong></p>
        <div className="mt-3"><PayoutConnectButton kind="shop" /></div>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Escrow ledger</h2>
      <ul className="mt-3 space-y-2">
        {(entries || []).map((e) => (
          <li key={e.id} className="rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm">
            <span className="font-semibold capitalize">{e.status.replace("_", " ")}</span>
            {" · gross $"}{(e.gross_cents / 100).toFixed(2)}{" · you $"}{(e.net_cents / 100).toFixed(2)}
            {e.release_at ? <span className="block text-xs text-[#7a5c4e]">Release {new Date(e.release_at).toLocaleString()}</span> : null}
          </li>
        ))}
        {!entries?.length ? <li className="text-sm text-[#7a5c4e]">No paid shop orders in escrow yet.</li> : null}
      </ul>
    </div>
  );
}
