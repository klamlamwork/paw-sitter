import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBlogDate, getSiteUrl } from "@/lib/blog";
import ShareButtons from "@/components/blog/ShareButtons";
import RelatedProducts from "@/components/blog/RelatedProducts";
import RelatedPosts from "@/components/blog/RelatedPosts";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("blog_posts").select("headline").eq("slug", slug).eq("published", true).maybeSingle();
  return { title: data ? `${data.headline} | Paw Sitter Blog` : "Blog | Paw Sitter" };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (!post) notFound();

  const [{ data: postTags }, { data: postProducts }, { data: relatedRows }] = await Promise.all([
    supabase.from("blog_post_tags").select("tag_id, blog_tags(id, name, slug)").eq("post_id", post.id),
    supabase.from("blog_post_products").select("sort_order, blog_products(*)").eq("post_id", post.id).order("sort_order"),
    supabase.from("blog_post_related").select("sort_order, related:related_post_id(id, slug, headline, published_at, created_at, published)").eq("post_id", post.id).order("sort_order"),
  ]);

  const tags = (postTags || []).map((r) => r.blog_tags).filter(Boolean);
  const products = (postProducts || []).map((r) => r.blog_products).filter((p) => p && p.is_active !== false);
  const related = (relatedRows || []).map((r) => r.related).filter((p) => p && p.published);
  const shareUrl = `${getSiteUrl()}/blog/${post.slug}`;
  const cover = (post.cover_image_url || "").trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 pb-36 lg:pb-10">
      <Link href="/blog" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Blog</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article>
          <header>
            <h1 className="text-3xl font-bold leading-tight text-[#3b2a22] sm:text-4xl">{post.headline}</h1>
            <p className="mt-3 text-sm text-[#7a5c4e]">{formatBlogDate(post.published_at || post.created_at)}</p>
            {tags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                    className="rounded-full border border-[#e8d5c4] bg-white px-2.5 py-0.5 text-xs font-medium text-[#5c4033] hover:border-[#c45c26] hover:text-[#c45c26]"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            ) : null}
            {cover ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-[#e8d5c4] bg-[#fff1e6]">
                <img
                  src={cover}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            ) : null}
          </header>
          <div
            className="blog-html mt-8 max-w-none space-y-4 text-[15px] leading-relaxed text-[#3b2a22] [&_a]:font-semibold [&_a]:text-[#c45c26] [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_img]:rounded-xl [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: post.content_html || "" }}
          />
          <div className="mt-10 border-t border-[#e8d5c4] pt-6">
            <ShareButtons url={shareUrl} title={post.headline} />
          </div>
          <RelatedPosts posts={related} />
        </article>
        <RelatedProducts products={products} />
      </div>
    </div>
  );
}
