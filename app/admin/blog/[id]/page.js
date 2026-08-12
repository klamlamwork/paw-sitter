import { redirect, notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BlogPostEditor from "@/components/blog/BlogPostEditor";
export const metadata = { title: "Edit blog post | Paw Sitter" };
export default async function AdminBlogEditPage({ params }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=/admin/blog/${id}`);
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: post } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (!post) notFound();
  const [{ data: tags }, { data: products }, { data: posts }, { data: pt }, { data: pp }, { data: pr }] = await Promise.all([
    supabase.from("blog_tags").select("id, name, slug").order("name"),
    supabase.from("blog_products").select("id, title, is_active").order("title"),
    supabase.from("blog_posts").select("id, headline, published").order("updated_at", { ascending: false }),
    supabase.from("blog_post_tags").select("tag_id").eq("post_id", post.id),
    supabase.from("blog_post_products").select("product_id").eq("post_id", post.id),
    supabase.from("blog_post_related").select("related_post_id").eq("post_id", post.id),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Edit post</h1>
      <div className="mt-8">
        <BlogPostEditor mode="edit" post={post} authorId={profile.id} allTags={tags || []} allProducts={products || []} allPosts={posts || []}
          initialTagIds={(pt || []).map((r) => r.tag_id)} initialProductIds={(pp || []).map((r) => r.product_id)} initialRelatedIds={(pr || []).map((r) => r.related_post_id)} />
      </div>
    </div>
  );
}
