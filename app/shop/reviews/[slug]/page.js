import Link from "next/link";
import { notFound } from "next/navigation";
import { publishedKolByPermalink } from "@/lib/kolPublic";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await publishedKolByPermalink(slug);
  if (!post) return { title: "Review | Paw Sitter" };
  return { title: `${post.title || "Review"} | Paw Sitter`, description: String(post.body || "").slice(0, 160) };
}

export default async function ShopReviewPermalinkPage({ params }) {
  const { slug } = await params;
  const post = await publishedKolByPermalink(slug);
  if (!post) notFound();
  const canonical = `/shop/reviews/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": post.verified_badge ? "Review" : "SocialMediaPosting",
    headline: post.title || "Review",
    datePublished: post.published_at,
    author: { "@type": "Person", name: post.author_name },
    url: canonical,
    ...(post.verified_badge && post.rating ? { reviewRating: { "@type": "Rating", ratingValue: post.rating, bestRating: 5 } } : {}),
    ...(post.product ? { itemReviewed: { "@type": "Product", name: post.product.name } } : {}),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/shop/reviews" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; All reviews</Link>
      {post.product?.slug ? <span className="text-sm text-[#7a5c4e]"> · <Link href={`/shop/p/${post.product.slug}`} className="font-semibold text-[#c45c26] hover:underline">{post.product.name}</Link></span> : null}
      {post.rating ? <p className="mt-4 text-sm font-semibold text-[#c77e10]">{post.rating}/5</p> : null}
      <h1 className="mt-2 text-3xl font-bold text-[#3b2a22]">{post.title || "Review"}</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">{post.author_name}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ""}</p>
      {post.verified_badge ? <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Community</p>}
      {post.body ? <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-[#3b2a22]">{post.body}</p> : null}
      {post.media?.length ? <div className="mt-6 grid gap-3">{post.media.map((asset) => asset.resource_type === "video" ? <video key={asset.id} controls preload="metadata" className="w-full rounded-2xl bg-black" src={asset.url} /> : <img key={asset.id} src={asset.url} alt="" className="w-full rounded-2xl object-cover" />)}</div> : null}
    </div>
  );
}
