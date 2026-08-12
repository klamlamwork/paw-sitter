import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BlogTagsAdmin from "@/components/blog/BlogTagsAdmin";
export const metadata = { title: "Blog tags | Paw Sitter" };
export default async function AdminBlogTagsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/blog/tags");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: tags } = await supabase.from("blog_tags").select("*").order("name");
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/admin/blog" className="text-sm font-semibold text-[#c45c26]">← Blog admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Tags</h1>
      <div className="mt-6"><BlogTagsAdmin initialTags={tags || []} /></div>
    </div>
  );
}
