import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SitterRatingBadge from "@/components/SitterRatingBadge";
import {
  averageRating,
  enabledServices,
  formatCityCountry,
  serviceLabel,
  serviceRateUnit,
  sitterPhotoUrl,
} from "@/lib/sitters";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sitters")
    .select("display_name")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return {
    title: data ? `${data.display_name} | Paw Sitter` : "Sitter | Paw Sitter",
  };
}

export default async function PublicSitterPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: sitter } = await supabase
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
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sitter) notFound();

  const { data: reviews } = await supabase
    .from("sitter_reviews")
    .select("id, rating, body, published_at")
    .eq("sitter_id", sitter.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const svcs = enabledServices(sitter);
  const bookHref = `/booking?sitter=${encodeURIComponent(sitter.id)}`;
  const photo = sitterPhotoUrl(sitter, 1400, 600);
  const ratingAvg = averageRating(reviews || []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/sitters" className="text-sm font-semibold text-[#c45c26] hover:underline">
        &larr; All sitters
      </Link>

      <div className="mt-6 overflow-hidden rounded-3xl border border-[#e8d5c4] bg-white shadow-sm">
        <div className="aspect-[21/9] w-full overflow-hidden bg-[#fff1e6]">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[#c4a484]">
              {(sitter.display_name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-3xl font-bold text-[#3b2a22]">{sitter.display_name}</h1>
            <SitterRatingBadge avg={ratingAvg} className="mt-1 text-base" />
          </div>
          <p className="mt-2 text-sm font-medium text-[#7a5c4e]">{formatCityCountry(sitter)}</p>

          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#3b2a22]">
              {sitter.bio?.trim() || "This sitter has not added a bio yet."}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">Services & rates</h2>
            {svcs.length === 0 ? (
              <p className="mt-2 text-sm text-[#7a5c4e]">No services listed yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {svcs.map((svc) => (
                  <li
                    key={svc.service_type}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-[#3b2a22]">{serviceLabel(svc.service_type)}</span>
                    <span className="text-[#5c4033]">
                      ${Number(svc.rate_regular || 0).toFixed(0)} regular / $
                      {Number(svc.rate_holiday || 0).toFixed(0)} holiday
                      <span className="text-xs text-[#7a5c4e]">
                        {" "}/ {serviceRateUnit(svc.service_type)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">Customer reviews</h2>
            {(reviews || []).length === 0 ? (
              <p className="mt-2 text-sm text-[#7a5c4e]">No published reviews yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(reviews || []).map((review) => (
                  <li key={review.id} className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/80 px-4 py-3">
                    <p className="text-sm font-semibold text-[#c45c26]">{"★".repeat(Number(review.rating) || 0)}{"☆".repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}</p>
                    {review.published_at ? <p className="mt-0.5 text-xs text-[#7a5c4e]">{new Date(review.published_at).toLocaleDateString()}</p> : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#3b2a22]">{review.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={bookHref} className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9a4519]">
              Book this sitter
            </Link>
            <Link href="/sitters" className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold text-[#5c4033]">
              Back to list
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
