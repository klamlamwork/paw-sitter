import Link from "next/link";
import { formatBlogDate } from "@/lib/blog";
export default function RelatedPosts({ posts }) {
  if (!posts?.length) return null;
  return (
    <section className="mt-12 border-t border-[#e8d5c4] pt-8">
      <h2 className="text-lg font-bold text-[#3b2a22]">Related posts</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="block rounded-2xl border border-[#e8d5c4] bg-white p-4 hover:border-[#c45c26]/40">
              <p className="font-semibold text-[#3b2a22]">{p.headline}</p>
              <p className="mt-1 text-xs text-[#7a5c4e]">{formatBlogDate(p.published_at || p.created_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
