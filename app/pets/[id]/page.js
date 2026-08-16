import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("pets").select("name").eq("id", id).maybeSingle();
  return { title: data ? `${data.name} | Paw Sitter` : "Pet | Paw Sitter" };
}

export default async function PublicPetPage({ params }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("pet_reviews")
    .select("id, body, published_at, sitters(id, display_name)")
    .eq("pet_id", id)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const published = reviews || [];
  if (!published.length) notFound();

  const { data: pet } = await admin.from("pets").select("id, name, species, breed, photo_url").eq("id", id).maybeSingle();
  if (!pet) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">{pet.name}</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
      {pet.photo_url ? <img src={pet.photo_url} alt="" className="mt-6 h-56 w-56 rounded-3xl object-cover" /> : null}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-[#7a5c4e]">Sitter reviews</h2>
      <ul className="mt-3 space-y-3">
        {published.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#e8d5c4] bg-white px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-[#7a5c4e]">
              {row.sitters?.id ? <Link href={`/sitters/${row.sitters.id}`} className="text-[#c45c26] hover:underline">{row.sitters.display_name}</Link> : "Sitter"}
              {" · Verified booking"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[#3b2a22]">{row.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
