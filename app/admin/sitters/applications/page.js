import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import AdminApplicationsClient from "../AdminApplicationsClient";

export const metadata = { title: "Sitter applications | Paw Sitter" };

export default async function AdminSitterApplicationsPage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/sitters/applications");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/admin/sitters" className="text-sm font-semibold text-[#c45c26] hover:underline">
        ← Admin sitters
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Sitter applications</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Approve to make the sitter bookable and set their role to sitter.</p>
      <AdminApplicationsClient />
    </div>
  );
}
