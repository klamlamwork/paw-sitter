"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KolProductFeed() {
  const path = usePathname() || "";
  const match = path.match(/^\/shop\/p\/([^/]+)$/);
  const slug = match ? decodeURIComponent(match[1]) : "";
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    if (!slug) { setPosts(null); return; }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/shop/kol/public?slug=${encodeURIComponent(slug)}`);
      const data = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) setPosts(data.posts || []);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (!slug || !posts?.length) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
      <h2 className="text-xl font-bold text-[#3b2a22]">Photo and video reviews</h2>
      <ul className="mt-4 space-y-4">
        {posts.map((post) => (
          <li key={post.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
            {post.rating ? <p className="text-sm font-semibold text-[#c77e10]">{post.rating}/5</p> : null}
            {post.title ? <p className="mt-1 font-semibold text-[#3b2a22]">{post.title}</p> : null}
            {post.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-[#3b2a22]">{post.body}</p> : null}
            <p className="mt-2 text-xs text-[#7a5c4e]">{post.author_name}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ""}</p>
            {post.verified_badge ? <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Community</p>}
            {post.media?.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {post.media.map((asset) => asset.resource_type === "video" ? (
                  <video key={asset.id} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" src={asset.url} />
                ) : (
                  <img key={asset.id} src={asset.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
            {post.href ? <Link href={post.href} className="mt-3 inline-block text-xs font-semibold text-[#c45c26] hover:underline">View full post</Link> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
