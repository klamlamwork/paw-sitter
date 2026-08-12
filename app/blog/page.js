import { Suspense } from "react";
import BlogIndexClient from "./BlogIndexClient";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Blog | Paw Sitter" };

export default async function BlogPage() {
  const supabase = await createClient();

  // Prefer cover_image_url; fall back if the column is missing or the query errors.
  let posts = [];
  let postsError = "";
  {
    const withCover = await supabase
      .from("blog_posts")
      .select("id, slug, headline, cover_image_url, published_at, created_at")
      .eq("published", true)
      .order("published_at", { ascending: false });

    if (!withCover.error) {
      posts = withCover.data || [];
    } else {
      const withoutCover = await supabase
        .from("blog_posts")
        .select("id, slug, headline, published_at, created_at")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (!withoutCover.error) {
        posts = (withoutCover.data || []).map((p) => ({ ...p, cover_image_url: "" }));
      } else {
        postsError = withoutCover.error.message || withCover.error.message || "Failed to load posts";
      }
    }
  }

  const [{ data: tags }, { data: postTags }] = await Promise.all([
    supabase.from("blog_tags").select("id, name, slug").order("name"),
    supabase.from("blog_post_tags").select("post_id, tag_id"),
  ]);

  const tagMap = {};
  for (const pt of postTags || []) {
    const pid = String(pt.post_id);
    if (!tagMap[pid]) tagMap[pid] = [];
    tagMap[pid].push(String(pt.tag_id));
  }
  const list = (posts || []).map((p) => ({
    ...p,
    id: p.id,
    cover_image_url: p.cover_image_url || "",
    tagIds: tagMap[String(p.id)] || [],
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Blog</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Tips and stories for pet parents and sitters.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-[#7a5c4e]">Loading posts…</p>}>
          <BlogIndexClient posts={list} tags={tags || []} loadError={postsError} />
        </Suspense>
      </div>
    </div>
  );
}
