import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { averageRating, sitterPhotoUrl } from "@/lib/sitters";
import SittersIndexClient from "./SittersIndexClient";

export const metadata = { title: "Sitters | Paw Sitter" };

export default async function SittersPage() {
  const supabase = await createClient();
  const { data: sitters, error } = await supabase
    .from("sitters")
    .select(
      `
      id,
      display_name,
      bio,
      service_city,
      service_country,
      profile_pic_public_id,
      profile_pic_version,
      is_active,
      sitter_services (
        service_type,
        enabled,
        rate_regular,
        rate_holiday
      )
    `
    )
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  const ids = (sitters || []).map((s) => s.id);
  const { data: ratingRows } = ids.length
    ? await supabase.from("sitter_reviews").select("sitter_id, rating").eq("status", "published").in("sitter_id", ids)
    : { data: [] };
  const ratingsBySitter = {};
  for (const row of ratingRows || []) {
    if (!ratingsBySitter[row.sitter_id]) ratingsBySitter[row.sitter_id] = [];
    ratingsBySitter[row.sitter_id].push(row);
  }

  const list = (sitters || []).map((s) => ({
    ...s,
    profile_pic_url: sitterPhotoUrl(s, 800, 450),
    rating_avg: averageRating(ratingsBySitter[s.id] || []),
    sitter_services: (s.sitter_services || []).filter((svc) => svc && svc.enabled !== false),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Our sitters</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#7a5c4e]">
        Browse active pet sitters. Open a profile for rates and details, then book when you are ready.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-[#7a5c4e]">Loading sitters…</p>}>
          <SittersIndexClient sitters={list} loadError={error?.message || ""} />
        </Suspense>
      </div>
    </div>
  );
}
