import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBlogDate } from "@/lib/blog";

export const metadata = { title: "Admin Blog | Paw Sitter" };

export default async function AdminBlogPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/blog");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, slug, headline, published, published_at, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#3b2a22]">Blog admin</h1>
          <p className="mt-1 text-sm text-[#7a5c4e]">Manage posts and tags.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/blog/tags"
            className="rounded-full border border-[#e8d5c4] bg-white px-4 py-2 text-sm font-semibold"
          >
            Tags
          </Link>
          <Link
            href="/admin/blog/new"
            className="rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white"
          >
            New post
          </Link>
        </div>
      </div>
      <ul className="mt-8 space-y-3">
        {(posts || []).map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8d5c4] bg-white p-4"
          >
            <div>
              <Link href={`/admin/blog/${p.id}`} className="font-semibold text-[#3b2a22] hover:text-[#c45c26]">
                {p.headline}
              </Link>
              <p className="text-xs text-[#7a5c4e]">
                /blog/{p.slug} · {p.published ? "Published" : "Draft"} ·{" "}
                {formatBlogDate(p.published_at || p.created_at)}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              {p.published ? (
                <Link href={`/blog/${p.slug}`} className="font-semibold text-[#c45c26]">
                  View
                </Link>
              ) : null}
              <Link href={`/admin/blog/${p.id}`} className="font-semibold text-[#5c4033]">
                Edit
              </Link>
            </div>
          </li>
        ))}
        {!posts?.length ? <p className="text-sm text-[#7a5c4e]">No posts yet.</p> : null}
      </ul>
    </div>
  );
}
