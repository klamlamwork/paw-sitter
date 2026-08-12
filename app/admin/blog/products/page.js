import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import BlogProductsAdmin from "@/components/blog/BlogProductsAdmin";
export const metadata = { title: "Blog products | Paw Sitter" };
export default async function AdminBlogProductsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin/blog/products");
  if (profile.role !== "admin") redirect("/account");
  const supabase = await createClient();
  const { data: products } = await supabase.from("blog_products").select("*").order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/admin/blog" className="text-sm font-semibold text-[#c45c26]">← Blog admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">Related products</h1>
      <p className="mt-1 text-sm text-[#7a5c4e]">Attach these to posts (sidebar / mobile bar).</p>
      <div className="mt-6"><BlogProductsAdmin initialProducts={products || []} /></div>
    </div>
  );
}
