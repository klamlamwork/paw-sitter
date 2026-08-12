"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBlogDate } from "@/lib/blog";

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  for (const v of list || []) {
    const s = String(v || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export default function BlogIndexClient({ posts = [], tags = [], loadError = "" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safePosts = Array.isArray(posts) ? posts : [];
  const safeTags = Array.isArray(tags) ? tags : [];

  // Support ?tag=a&tag=b and legacy ?tag=a,b
  const tagParams = useMemo(() => {
    const raw = [];
    try {
      raw.push(...(searchParams.getAll("tag") || []));
    } catch {
      const one = searchParams.get("tag");
      if (one) raw.push(one);
    }
    const expanded = [];
    for (const part of raw) {
      String(part || "")
        .split(",")
        .forEach((p) => expanded.push(p));
    }
    return uniqueStrings(expanded);
  }, [searchParams]);

  const [activeIds, setActiveIds] = useState([]);

  useEffect(() => {
    if (!tagParams.length) {
      setActiveIds([]);
      return;
    }
    const ids = [];
    for (const slug of tagParams) {
      const match = safeTags.find((t) => t.slug === slug);
      if (match) ids.push(String(match.id));
    }
    setActiveIds(uniqueStrings(ids));
  }, [tagParams, safeTags]);

  function writeUrl(nextIds) {
    const slugs = nextIds
      .map((id) => safeTags.find((t) => String(t.id) === String(id))?.slug)
      .filter(Boolean);
    if (!slugs.length) {
      router.replace("/blog", { scroll: false });
      return;
    }
    const qs = slugs.map((s) => `tag=${encodeURIComponent(s)}`).join("&");
    router.replace(`/blog?${qs}`, { scroll: false });
  }

  function clearTags() {
    setActiveIds([]);
    writeUrl([]);
  }

  function toggleTag(id, slug) {
    const sid = String(id);
    const exists = activeIds.includes(sid);
    const next = exists ? activeIds.filter((x) => x !== sid) : [...activeIds, sid];
    setActiveIds(next);
    // Prefer slug list from next ids for URL
    if (!next.length) {
      writeUrl([]);
      return;
    }
    // Ensure the toggled slug is reflected even if tags list is briefly stale
    const slugs = next
      .map((nid) => {
        if (String(nid) === sid) return slug;
        return safeTags.find((t) => String(t.id) === String(nid))?.slug;
      })
      .filter(Boolean);
    const qs = uniqueStrings(slugs).map((s) => `tag=${encodeURIComponent(s)}`).join("&");
    router.replace(qs ? `/blog?${qs}` : "/blog", { scroll: false });
  }

  const filtered = useMemo(() => {
    if (!activeIds.length) return safePosts;
    // AND: post must include every selected tag id
    return safePosts.filter((p) => {
      const ids = (p.tagIds || []).map(String);
      return activeIds.every((id) => ids.includes(String(id)));
    });
  }, [safePosts, activeIds]);

  if (loadError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load posts: {loadError}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clearTags}
          className={
            "rounded-full px-3 py-1.5 text-xs font-semibold " +
            (activeIds.length === 0
              ? "bg-[#c45c26] text-white"
              : "border border-[#e8d5c4] bg-white text-[#5c4033]")
          }
        >
          All
        </button>
        {safeTags.map((t) => {
          const selected = activeIds.includes(String(t.id));
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleTag(t.id, t.slug)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold " +
                (selected
                  ? "bg-[#c45c26] text-white"
                  : "border border-[#e8d5c4] bg-white text-[#5c4033]")
              }
            >
              {t.name}
            </button>
          );
        })}
      </div>

      {activeIds.length > 0 ? (
        <p className="mt-3 text-xs text-[#7a5c4e]">
          Showing posts that include <strong>all</strong> selected tags
          {activeIds.length > 1 ? ` (${activeIds.length})` : ""}.{" "}
          <button type="button" onClick={clearTags} className="font-semibold text-[#c45c26] hover:underline">
            Clear filters
          </button>
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="mt-10 space-y-3">
          <p className="text-sm text-[#7a5c4e]">
            {safePosts.length === 0
              ? "No published posts yet."
              : activeIds.length > 0
                ? "No posts match all selected tags."
                : "No posts yet."}
          </p>
          {activeIds.length > 0 && safePosts.length > 0 ? (
            <button
              type="button"
              onClick={clearTags}
              className="text-sm font-semibold text-[#c45c26] hover:underline"
            >
              Clear tag filters
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
