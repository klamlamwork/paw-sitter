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
      <p className="mt-2 text-sm text-[#7a5c4e]">Verified text reviews and published photo/video reviews from the shop.</p>

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

      <h2 className="mt-10 text-xl font-bold text-[#3b2a22]">Photo and video reviews</h2>
      {!kolPosts.length ? <p className="mt-3 text-sm text-[#7a5c4e]">No published photo or video reviews yet.</p> : (
        <ul className="mt-4 space-y-4">
          {kolPosts.map((post) => (
            <li key={post.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
              {post.rating ? <p className="text-sm font-semibold text-[#c77e10]">{post.rating}/5</p> : null}
              {post.title ? <p className="mt-1 font-semibold text-[#3b2a22]">{post.title}</p> : null}
              {post.body ? <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-[#3b2a22]">{post.body}</p> : null}
              <p className="mt-2 text-xs text-[#7a5c4e]">{post.author_name}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ""}</p>
              {post.verified_badge ? <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Community</p>}
              {post.product?.slug ? <Link href={`/shop/p/${post.product.slug}`} className="mt-2 mr-3 inline-block text-xs font-semibold text-[#c45c26] hover:underline">{post.product.name}</Link> : null}
              <Link href={post.href} className="mt-2 inline-block text-xs font-semibold text-[#c45c26] hover:underline">View full post</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
