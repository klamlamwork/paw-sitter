import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import SitterDashboardClient from "./SitterDashboardClient";
import SitterApplicationBar from "./SitterApplicationBar";

export const metadata = { title: "Sitter dashboard | Paw Sitter" };

const SITTER_SELECT = "*, sitter_services(*), sitter_weekly_availability(*), sitter_gallery(*)";

async function loadSitter(admin, profile) {
  const { data: byProfile } = await admin
    .from("sitters")
    .select(SITTER_SELECT)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (byProfile) return byProfile;

  const email = String(profile.email || "").trim().toLowerCase();
  if (!email) return null;
  const { data: byInvite } = await admin
    .from("sitters")
    .select(SITTER_SELECT)
    .eq("invite_email", email)
    .maybeSingle();
  return byInvite || null;
}

async function ensureApplicantSitter(admin, profile) {
  const email = String(profile.email || "").trim().toLowerCase();
  let existing = null;

  const { data: byProfile } = await admin
    .from("sitters")
    .select("id, profile_id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  existing = byProfile;

  if (!existing && email) {
    const { data: byInvite } = await admin
      .from("sitters")
      .select("id, profile_id")
      .eq("invite_email", email)
      .maybeSingle();
    existing = byInvite;
  }

  if (existing) {
    if (!existing.profile_id) {
      await admin.from("sitters").update({ profile_id: profile.id }).eq("id", existing.id);
    }
    return existing.id;
  }

  const name = profile.full_name || (email ? email.split("@")[0] : "Applicant");
  const { data: created, error } = await admin
    .from("sitters")
    .insert({
      profile_id: profile.id,
      invite_email: email || null,
      display_name: name,
      bio: "",
      is_active: false,
      application_status: "pending",
      applied_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export default async function SitterDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/sitter/dashboard");

  let sitter = null;
  let bootError = "";
  try {
    const admin = createAdminClient();
    await ensureApplicantSitter(admin, profile);
    sitter = await loadSitter(admin, profile);
  } catch (err) {
    bootError = err?.message || String(err);
  }

  if (!sitter) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-[#3b2a22]">Sitter application</h1>
        <p className="mt-3 text-sm text-red-700">
          {bootError || `Could not open an application for ${profile.email}.`}
        </p>
        <p className="mt-2 text-sm text-[#7a5c4e]">
          Run <code>sql/83-sitter-applications.sql</code> in Supabase and confirm{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> is set in Vercel, then refresh.
        </p>
      </div>
    );
  }

  const pending = sitter.application_status !== "approved";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">
        {pending ? "Sitter application" : "Sitter dashboard"}
      </h1>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link className="font-semibold text-[#c45c26] hover:underline" href="/sitter/calendar">
          Availability calendar
        </Link>
        <Link className="font-semibold text-[#c45c26] hover:underline" href="/sitter/bookings">
          Booking requests
        </Link>
      </div>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        Fill every required field, save, verify your phone, then submit. Admin reviews at /admin/sitters/applications.
      </p>
      <SitterApplicationBar sitter={sitter} />
      <SitterDashboardClient sitter={sitter} />
    </div>
  );
}
