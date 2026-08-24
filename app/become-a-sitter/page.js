import Link from "next/link";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "Become a sitter | Paw Sitter" };

export default async function BecomeASitterPage() {
  const profile = await getProfile();
  const href = profile ? "/sitter/dashboard" : "/login?next=/sitter/dashboard";
  const label = profile ? "Continue application" : "Apply to be a sitter";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Become a Paw Sitter</h1>
      <p className="mt-3 text-[#7a5c4e]">
        First create a free customer account (or log in). Then complete the sitter application on your dashboard.
        All profile, service, weekly-hours, and phone fields are required. We review each application before you go live.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[#5c4033]">
        <li>Sign up or log in as a customer.</li>
        <li>Fill every field on the sitter dashboard, including street address.</li>
        <li>Verify your mobile number by SMS (country code + number).</li>
        <li>Submit. Admin approves before customers can book you.</li>
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={href} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white">
          {label}
        </Link>
        {!profile ? (
          <Link href="/login?next=/sitter/dashboard" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold">
            I already have an account
          </Link>
        ) : null}
      </div>
    </div>
  );
}
