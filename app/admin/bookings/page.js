import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminBookingsClient from "./AdminBookingsClient";

export const metadata = { title: "Admin bookings | Paw Sitter" };

export default async function AdminBookingsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/bookings");
  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("bookings")
    .select("id, status, payment_method, payment_status, payment_received, service_type, estimated_total, price_breakdown, created_at, booking_slots(*), customer:profiles!customer_id(full_name, email), sitters(display_name, invite_email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/admin/sitters" className="text-sm font-semibold text-[#c45c26] hover:underline">← Admin sitters</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">All sitter bookings</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Review every sitter booking. Only e-transfer payments can be confirmed manually here.</p>
      <AdminBookingsClient initialBookings={bookings || []} />
    </div>
  );
}
