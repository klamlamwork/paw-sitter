"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBlogDate } from "@/lib/blog";

export default function BlogIndexClient({ posts, tags }) {
  const [active, setActive] = useState(null);
  const filtered = useMemo(() => {
    if (!active) return posts;
    return posts.filter((p) => (p.tagIds || []).includes(active));
  }, [posts, active]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActive(null)} className={"rounded-full px-3 py-1.5 text-xs font-semibold " + (active == null ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")}>All</button>
        {tags.map((t) => (
          <button key={t.id} type="button" onClick={() => setActive(t.id === active ? null : t.id)} className={"rounded-full px-3 py-1.5 text-xs font-semibold " + (active === t.id ? "bg-[#c45c26] text-white" : "border border-[#e8d5c4] bg-white text-[#5c4033]")}>{t.name}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-[#7a5c4e]">No posts in this tag yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="rounded-2xl border border-[#e8d5c4] bg-white p-5 shadow-sm transition hover:border-[#c45c26]/50 hover:shadow-md">
              <h2 className="text-lg font-bold leading-snug text-[#3b2a22]">{p.headline}</h2>
              <p className="mt-3 text-xs font-medium text-[#7a5c4e]">{formatBlogDate(p.published_at || p.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
