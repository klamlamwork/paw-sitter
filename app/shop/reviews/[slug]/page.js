import Link from "next/link";
import { notFound } from "next/navigation";
import { publishedKolByPermalink } from "@/lib/kolPublic";
import { attachKolStoodOut } from "@/lib/kolStoodOut";
import KolArticle from "@/app/shop/KolArticle";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await publishedKolByPermalink(slug);
  if (!post) return { title: "Review | Paw Sitter" };
  return { title: `${post.title || "Review"} | Paw Sitter`, description: String(post.body || post.key_takeaways?.[0] || "").slice(0, 160) };
}

export default async function ShopReviewPermalinkPage({ params }) {
  const { slug } = await params;
  const post = await attachKolStoodOut(await publishedKolByPermalink(slug));
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop/reviews" className="text-sm font-semibold text-[#3b2a22] hover:underline">&larr; All reviews</Link>
      <div className="mt-6"><KolArticle post={post} /></div>
    </div>
  );
}
