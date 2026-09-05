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
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/shop/reviews" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; All reviews</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Write a photo or video review</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Pick a brand, then choose catalog products from the popup. Add one cover video (up to 15 minutes) or a cover photo, key takeaways, and optional per-product galleries. Community posts are not verified purchases. Photos may earn 300 Paw Points; a video may earn 800 after admin approval.</p>
      <CommunityKolForm initialSlug={params?.product || ""} />
    </div>
  );
}
