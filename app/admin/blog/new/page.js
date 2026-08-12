import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BlogPostEditor from "@/components/blog/BlogPostEditor";

export const metadata = { title: "New blog post | Paw Sitter" };

export default async function AdminBlogNewPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/blog/new");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const [{ data: tags }, { data: posts }] = await Promise.all([
    supabase.from("blog_tags").select("id, name, slug").order("name"),
    supabase.from("blog_posts").select("id, headline, published").order("updated_at", { ascending: false }),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">New post</h1>
      <div className="mt-8">
        <BlogPostEditor
          mode="create"
          authorId={profile.id}
          allTags={tags || []}
          allProducts={[]}
          allPosts={posts || []}
        />
      </div>
    </div>
  );
}
