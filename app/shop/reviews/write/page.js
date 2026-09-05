import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import CommunityKolForm from "./CommunityKolForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write a photo or video review | Paw Sitter" };

export default async function WriteCommunityKolPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/shop/reviews/write");
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link href="/shop/reviews" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; All reviews</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Write a photo or video review</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Choose a catalog product, add photos or a video, then submit for admin approval. This is a community post, not a verified purchase. Photos may earn 300 Paw Points; a video may earn 800 after approval.</p>
      <CommunityKolForm initialSlug={params?.product || ""} />
    </div>
  );
}
