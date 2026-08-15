import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AccountLocationClient from "./AccountLocationClient";
import MyPawKidsClient from "./MyPawKidsClient";
import AccountBookingsClient from "./AccountBookingsClient";

export const metadata = { title: "My account | Paw Sitter" };

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, payment_status, payment_method, estimated_total, price_breakdown, created_at, sitters(display_name), booking_slots(starts_at)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: pets } = await supabase
    .from("pets")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">My account</h1>
      <p className="mt-2 text-[#7a5c4e]">
        Signed in as <strong>{profile.email}</strong> - role:{" "}
        <span className="font-semibold text-[#c45c26]">{profile.role}</span>
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/booking" className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white">New booking</Link>
        {(profile.role === "sitter" || profile.role === "admin") && (
          <Link href="/sitter/dashboard" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Sitter dashboard</Link>
        )}
        {profile.role === "admin" && (
          <Link href="/admin/sitters" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">Admin sitters</Link>
        )}
      </div>
      <AccountLocationClient profile={profile} />
      <h2 className="mt-10 text-xl font-semibold">My Paw Kids</h2>
      <MyPawKidsClient initialPets={pets || []} profileId={profile.id} />
      <h2 className="mt-10 text-xl font-semibold">Your bookings</h2>
      <AccountBookingsClient bookings={bookings || []} />
    </div>
  );
}
