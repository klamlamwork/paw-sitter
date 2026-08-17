import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import HolidayAdminClient from "./HolidayAdminClient";

export const metadata = { title: "Holidays | Paw Sitter" };

export default async function AdminHolidaysPage() {
  try {
    await requireRole("admin");
  } catch {
    redirect("/login?next=/admin/holidays");
  }
  const admin = createAdminClient();
  const { data } = await admin.from("holiday_dates").select("holiday_date, name").order("holiday_date");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/sitters" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Holiday calendar</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Days you mark here use each sitter’s holiday rate on house sits, boarding, walks, and drop-ins. If a sitter has no holiday rate, the regular rate is used.</p>
      <HolidayAdminClient initialHolidays={data || []} />
    </div>
  );
}
