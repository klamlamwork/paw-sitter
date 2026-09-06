import Link from "next/link";
import { publishedKolByAuthor } from "@/lib/kolPublic";

export const dynamic = "force-dynamic";

export default async function AuthorReviewsPage({ params }) {
  const { id } = await params;
  const posts = await publishedKolByAuthor(id);
  const name = posts[0]?.author_name || "Member";
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/reviews" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; All reviews</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">{name}</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Published photo and video reviews.</p>
      {!posts.length ? <p className="mt-6 text-sm text-[#7a5c4e]">No published reviews yet.</p> : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id} className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white">
              <Link href={post.href} className="block">
                {post.cover?.url ? (post.cover.resource_type === "video" ? <video src={post.cover.url} className="h-40 w-full object-cover" muted /> : <img src={post.cover.url} alt="" className="h-40 w-full object-cover" />) : <div className="h-40 bg-[#fff8f0]" />}
                <div className="p-3">
                  <p className="text-xs text-[#7a5c4e]">{post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}</p>
                  <p className="mt-1 font-semibold text-[#3b2a22]">{post.title || "Review"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
