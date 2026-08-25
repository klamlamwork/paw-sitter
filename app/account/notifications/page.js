import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NotificationPrefsClient from "./NotificationPrefsClient";

export const metadata = { title: "Notification preferences | Paw Sitter" };

export default async function NotificationPrefsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account/notifications");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/account" className="text-sm font-semibold text-[#c45c26] hover:underline">
        ← Account
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Notifications</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        Transactional booking and order email is on by default. SMS stays off until you opt in.
      </p>
      <NotificationPrefsClient />
    </div>
  );
}
