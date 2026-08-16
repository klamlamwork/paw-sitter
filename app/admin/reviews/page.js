import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminReviewsClient from "./AdminReviewsClient";

export const metadata = { title: "Admin Reviews | Paw Sitter" };

export default async function AdminReviewsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/reviews");
  const admin = createAdminClient();
  const [{ data: sitterReviews }, { data: petReviews }] = await Promise.all([
    admin
      .from("sitter_reviews")
      .select("id, rating, body, status, created_at, sitters(display_name), bookings(id, service_type)")
      .order("created_at", { ascending: false }),
    admin
      .from("pet_reviews")
      .select("id, body, status, created_at, pets(name, species), sitters(display_name)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Admin - Reviews</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Approve customer reviews of sitters and sitter notes about pets before they go public.</p>
      <p className="mt-2 text-sm">
        <Link href="/admin/sitters" className="font-semibold text-[#c45c26] hover:underline">Back to sitters</Link>
      </p>
      <AdminReviewsClient sitterReviews={sitterReviews || []} petReviews={petReviews || []} />
    </div>
  );
}
