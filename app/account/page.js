import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "My account | Paw Sitter" };
export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, service_type, status, estimated_total, created_at, sitters(display_name)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
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
      <h2 className="mt-10 text-xl font-semibold">Your bookings</h2>
      <ul className="mt-4 space-y-3">
        {(bookings || []).length === 0 ? (
          <li className="text-sm text-[#7a5c4e]">No bookings yet.</li>
        ) : (
          bookings.map((b) => (
            <li key={b.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/90 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">
                  {b.service_type === "house_sit" ? "House sit" : "Drop-in"} - {b.sitters?.display_name || "Sitter"}
                </span>
                <span className="rounded-full bg-[#f3e0d0] px-2 py-0.5 text-xs capitalize text-[#c45c26]">{b.status}</span>
              </div>
              <p className="mt-1 text-[#7a5c4e]">Est. ${Number(b.estimated_total || 0).toFixed(2)} CAD</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
