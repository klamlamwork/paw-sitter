import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SitterDiscountsClient from "./SitterDiscountsClient";

export const metadata = { title: "My Discounts | Paw Sitter" };

export default async function SitterDiscountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/sitter/discounts");
  const { data: sitter } = await supabase.from("sitters").select("id").eq("profile_id", user.id).maybeSingle();
  if (!sitter) redirect("/sitter/dashboard");
  const { data: codes } = await supabase.from("discount_codes").select("*").eq("vendor_sitter_id", sitter.id).order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">My Discounts</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Create promos for your own bookings. Discounts reduce your payout.</p>
      <SitterDiscountsClient initial={codes || []} sitterId={sitter.id} />
    </div>
  );
}
