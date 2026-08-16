import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SitterBookingsClient from "./SitterBookingsClient";

export const metadata = { title: "Sitter bookings | Paw Sitter" };

export default async function SitterBookingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/sitter/bookings");
  const supabase = await createClient();
  const { data: sitter } = await supabase
    .from("sitters")
    .select("id, timezone, service_city, service_country")
    .eq("profile_id", profile.id)
    .maybeSingle();

  let query = supabase
    .from("bookings")
    .select("*, booking_slots(*), profiles:customer_id(full_name, email, city, country, timezone), sitters(service_city, service_country, timezone)")
    .order("created_at", { ascending: false });

  if (sitter) query = query.eq("sitter_id", sitter.id);
  else query = query.eq("id", "00000000-0000-0000-0000-000000000000");

  const { data: bookingsRaw } = await query;
  const bookings = await attachBookingPets(bookingsRaw || [], sitter?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22]">Booking requests</h1>
          <p className="mt-2 text-sm text-[#7a5c4e]">
            Accept or decline requests. After accept, mark paid when payment is received.
            {sitter?.timezone ? <> Your timezone: <strong>{sitter.timezone}</strong>{sitter.service_city ? ` (${sitter.service_city})` : ""}.</> : null}
          </p>
        </div>
        <Link href="/sitter/calendar" className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold text-[#5c4033]">
          Calendar
        </Link>
      </div>
      <SitterBookingsClient bookings={bookings || []} sitterTimezone={sitter?.timezone || null} sitterLocation={sitter || null} />
    </div>
  );
}

async function attachBookingPets(bookings, sitterId) {
  if (!bookings.length || !sitterId) return bookings.map((b) => ({ ...b, pets: [] }));
  const admin = createAdminClient();
  const ids = bookings.map((b) => b.id);
  const { data: links } = await admin.from("booking_pets").select("booking_id, pet_id").in("booking_id", ids);
  const petIds = [...new Set((links || []).map((row) => row.pet_id).filter(Boolean))];
  if (!petIds.length) return bookings.map((b) => ({ ...b, pets: [] }));

  const [{ data: pets }, { data: reviews }] = await Promise.all([
    admin.from("pets").select("id, name, species, breed, weight_lbs, age_years, age_months, sex, is_spayed_neutered, medications, notes, photo_url").in("id", petIds),
    admin.from("pet_reviews").select("id, pet_id, body, published_at, status, sitters(id, display_name)").in("pet_id", petIds).eq("status", "published").order("published_at", { ascending: false }),
  ]);

  const petById = Object.fromEntries((pets || []).map((p) => [p.id, { ...p, reviews: [] }]));
  for (const review of reviews || []) {
    if (petById[review.pet_id]) petById[review.pet_id].reviews.push(review);
  }
  const petsByBooking = {};
  for (const link of links || []) {
    if (!petsByBooking[link.booking_id]) petsByBooking[link.booking_id] = [];
    if (petById[link.pet_id]) petsByBooking[link.booking_id].push(petById[link.pet_id]);
  }
  return bookings.map((b) => ({ ...b, pets: petsByBooking[b.id] || [] }));
}
