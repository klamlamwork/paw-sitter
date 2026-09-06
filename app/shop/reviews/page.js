import Link from "next/link";
import { recentStandardReviews } from "@/lib/shopReviewIndex";
import { publishedKolAll } from "@/lib/kolPublic";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews | Paw Sitter" };

export default async function ShopReviewsIndexPage() {
  const [reviews, kolPosts] = await Promise.all([recentStandardReviews(), publishedKolAll()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Reviews</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Photo and video reviews, plus verified text reviews. <Link href="/shop/reviews/write" className="font-semibold text-[#c45c26] hover:underline">Write a photo or video review</Link></p>

      <h2 className="mt-10 text-xl font-bold text-[#3b2a22]">Photo and video reviews</h2>
      {!kolPosts.length ? <p className="mt-3 text-sm text-[#7a5c4e]">No published photo or video reviews yet.</p> : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kolPosts.map((post) => (
            <li key={post.id} className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white">
              <Link href={post.href} className="block">
                {post.cover?.url ? (post.cover.resource_type === "video" ? <video src={post.cover.url} className="h-40 w-full object-cover" muted /> : <img src={post.cover.url} alt="" className="h-40 w-full object-cover" />) : <div className="h-40 bg-[#fff8f0]" />}
              </Link>
              <div className="p-3">
                <p className="text-xs text-[#7a5c4e]">{post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}</p>
                <Link href={post.href} className="mt-1 block font-semibold text-[#3b2a22] hover:text-[#c45c26]">{post.title || "Review"}</Link>
                {post.products?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.products.map((product) => product.slug ? <Link key={product.id} href={`/shop/p/${product.slug}`} className="rounded-full bg-[#fff8f0] px-2 py-0.5 text-[11px] font-semibold text-[#c45c26]">{product.name}</Link> : <span key={product.id} className="rounded-full bg-[#fff8f0] px-2 py-0.5 text-[11px]">{product.name}</span>)}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-bold text-[#3b2a22]">Text reviews</h2>
      {!reviews.length ? <p className="mt-3 text-sm text-[#7a5c4e]">No text reviews yet.</p> : (
        <ul className="mt-4 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
              <p className="text-sm font-semibold text-[#c77e10]">{review.rating}/5</p>
              {review.title ? <p className="mt-1 font-semibold text-[#3b2a22]">{review.title}</p> : null}
              {review.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-[#3b2a22]">{review.body}</p> : null}
              <p className="mt-2 text-xs text-[#7a5c4e]">{review.author_name}{review.created_at ? ` · ${new Date(review.created_at).toLocaleDateString()}` : ""}</p>
              {review.verified_purchase ? <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : null}
              {review.product?.slug ? <Link href={`/shop/p/${review.product.slug}`} className="mt-2 inline-block text-xs font-semibold text-[#c45c26] hover:underline">{review.product.name}</Link> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
