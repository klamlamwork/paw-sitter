import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AccountShopLayout({ children }) {
  let profile;
  try {
    profile = await getProfile();
  } catch {
    redirect("/login?next=/account/shop");
  }
  if (!profile) redirect("/login?next=/account/shop");

  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("shop_shops")
    .select("id")
    .eq("owner_profile_id", profile.id)
    .limit(1);

  if (!owned?.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
          &larr; Account
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Shop portal</h1>
        <p className="mt-3 text-sm text-[#5c4033]">
          This account is not assigned as a shop owner. An admin must set your email as the shop&apos;s
          owner email at Admin → Shops before you can use this dashboard.
        </p>
      </div>
    );
  }

  return children;
}
