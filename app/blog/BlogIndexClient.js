"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBlogDate } from "@/lib/blog";

export default function BlogIndexClient({ posts = [], tags = [], loadError = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag");
  const [active, setActive] = useState(null);
  const safePosts = Array.isArray(posts) ? posts : [];
  const safeTags = Array.isArray(tags) ? tags : [];

  useEffect(() => {
    if (!tagParam) {
      setActive(null);
      return;
    }
    const match = safeTags.find((t) => t.slug === tagParam);
    setActive(match ? String(match.id) : null);
  }, [tagParam, safeTags]);

  function selectTag(id, slug) {
    if (id == null || String(id) === String(active)) {
      setActive(null);
      router.replace("/blog", { scroll: false });
      return;
    }
    setActive(String(id));
    router.replace(`/blog?tag=${encodeURIComponent(slug)}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    if (!active) return safePosts;
    return safePosts.filter((p) => (p.tagIds || []).map(String).includes(String(active)));
  }, [safePosts, active]);

  if (loadError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load posts: {loadError}
      </p>
    );
  }

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
        {safeTags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTag(t.id, t.slug)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-semibold " +
              (String(active) === String(t.id) ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")
            }
          >
            {t.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 space-y-3">
          <p className="text-sm text-[#7a5c4e]">
            {safePosts.length === 0
              ? "No published posts yet."
              : "No posts in this tag yet."}
          </p>
          {active != null && safePosts.length > 0 ? (
            <button
              type="button"
              onClick={() => selectTag(null)}
              className="text-sm font-semibold text-[#c45c26] hover:underline"
            >
              Clear tag filter
            </button>
          ) : null}
        </div>
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
                <p className="mt-3 text-xs font-medium text-[#7a5c4e]">
                  {formatBlogDate(p.published_at || p.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
