"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBlogDate } from "@/lib/blog";

export default function BlogIndexClient({ posts, tags }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag");
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!tagParam) {
      setActive(null);
      return;
    }
    const match = (tags || []).find((t) => t.slug === tagParam);
    setActive(match ? match.id : null);
  }, [tagParam, tags]);

  function selectTag(id, slug) {
    if (id == null || id === active) {
      setActive(null);
      router.replace("/blog", { scroll: false });
      return;
    }
    setActive(id);
    router.replace(`/blog?tag=${encodeURIComponent(slug)}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    if (!active) return posts;
    return posts.filter((p) => (p.tagIds || []).includes(active));
  }, [posts, active]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectTag(null)}
          className={
            "rounded-full px-3 py-1.5 text-xs font-semibold " +
            (active == null ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")
          }
        >
          All
        </button>
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTag(t.id, t.slug)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-semibold " +
              (active === t.id ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")
            }
          >
            {t.name}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-[#7a5c4e]">No posts in this tag yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="overflow-hidden rounded-2xl border border-[#e8d5c4] bg-white shadow-sm transition hover:border-[#c45c26]/50 hover:shadow-md"
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-[#fff1e6]">
                {p.cover_image_url ? (
                  <img
                    src={p.cover_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[#c4a484]">
                    Paw Sitter
                  </div>
                )}
              </div>
              <div className="p-5">
                <h2 className="text-lg font-bold leading-snug text-[#3b2a22]">{p.headline}</h2>
                <p className="mt-3 text-xs font-medium text-[#7a5c4e]">{formatBlogDate(p.published_at || p.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
