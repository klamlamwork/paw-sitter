import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SitterDashboardClient from "./SitterDashboardClient";
import SitterApplicationBar from "./SitterApplicationBar";

export const metadata = { title: "Sitter dashboard | Paw Sitter" };

async function loadSitter(supabase, profile) {
  const { data: byProfile } = await supabase
    .from("sitters")
    .select("*, sitter_services(*), sitter_weekly_availability(*), sitter_gallery(*)")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (byProfile) return byProfile;

  const email = String(profile.email || "").trim().toLowerCase();
  if (!email) return null;
  const { data: byInvite } = await supabase
    .from("sitters")
    .select("*, sitter_services(*), sitter_weekly_availability(*), sitter_gallery(*)")
    .eq("invite_email", email)
    .maybeSingle();
  return byInvite || null;
}

async function ensureApplicantSitter(profile) {
  const admin = createAdminClient();
  const email = String(profile.email || "").trim().toLowerCase();
  const { data: existing } = await admin
    .from("sitters")
    .select("id, profile_id")
    .or(`profile_id.eq.${profile.id}${email ? `,invite_email.eq.${email}` : ""}`)
    .maybeSingle();

  if (existing) {
    if (!existing.profile_id) {
      await admin.from("sitters").update({ profile_id: profile.id }).eq("id", existing.id);
    }
    return existing.id;
  }

  const name = profile.full_name || email.split("@")[0] || "Applicant";
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

  const supabase = await createClient();
  let sitter = await loadSitter(supabase, profile);

  if (!sitter && profile.role !== "admin") {
    try {
      await ensureApplicantSitter(profile);
      sitter = await loadSitter(supabase, profile);
    } catch (err) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-2xl font-bold">Sitter application</h1>
          <p className="mt-3 text-sm text-red-700">{err.message || "Could not start your application."}</p>
          <p className="mt-2 text-sm text-[#7a5c4e]">
            Confirm <code>sql/83-sitter-applications.sql</code> was run and <code>SUPABASE_SERVICE_ROLE_KEY</code> is set.
          </p>
        </div>
      );
    }
  }

  if (!sitter) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">Sitter dashboard</h1>
        <p className="mt-3 text-[#7a5c4e]">
          No sitter profile linked to <strong>{profile.email}</strong>.
        </p>
      </div>
    );
  }

  const pending = sitter.application_status && sitter.application_status !== "approved";

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
        Weekly hours below are the default. Use the calendar for specific days and services.
      </p>
      <SitterApplicationBar sitter={sitter} />
      <SitterDashboardClient sitter={sitter} />
    </div>
  );
}
