import Link from "next/link";
import { getProfile } from "@/lib/auth";
export default async function AuthButtons() {
  const profile = await getProfile();
  if (!profile) {
    return (
      <Link href="/login" className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a4519]">
        Log in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {profile.role === "admin" ? (
        <Link href="/admin/sitters" className="hidden text-sm font-medium text-[#5c4033] sm:inline">Admin</Link>
      ) : null}
      {(profile.role === "sitter" || profile.role === "admin") ? (
        <>
          <Link href="/sitter/calendar" className="hidden text-sm font-medium text-[#5c4033] sm:inline">Calendar</Link>
          <Link href="/sitter/dashboard" className="hidden text-sm font-medium text-[#5c4033] sm:inline">Sitter</Link>
        </>
      ) : null}
      <Link href="/account" className="hidden max-w-[120px] truncate text-sm font-medium text-[#5c4033] sm:inline">
        {profile.full_name || "Account"}
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033]">
          Log out
        </button>
      </form>
    </div>
  );
}
