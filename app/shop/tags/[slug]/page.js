import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enrichProducts } from "@/lib/shopCatalog";
import ShopProductsPanel from "../../ShopProductsPanel";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${slug} | Shop tags | Paw Sitter` };
}

export default async function ShopTagHubPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tag } = await supabase.from("shop_tags").select("id, name, slug, description").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!tag) notFound();

  const { data: productLinks } = await supabase.from("shop_product_tags").select("product_id").eq("tag_id", tag.id);
  const productIds = [...new Set((productLinks || []).map((row) => row.product_id))];
  let products = [];
  let coverByProduct = {};
  if (productIds.length) {
    const { data: productRows } = await supabase
      .from("shop_products")
      .select("id, name, slug, short_description, price_cents, currency, hide_price, brand_name, category_id, updated_at, status")
      .eq("status", "approved")
      .in("id", productIds);
    const enriched = await enrichProducts(supabase, productRows || []);
    products = enriched.products || [];
    coverByProduct = enriched.coverByProduct || {};
  }

  const { data: reviews } = productIds.length
    ? await supabase.from("shop_product_reviews").select("id, rating, title, body, product_id, created_at, product:shop_products(name, slug)").in("product_id", productIds).order("created_at", { ascending: false }).limit(20)
    : { data: [] };

  const [{ data: kolLinks }, { data: kolProductLinks }] = await Promise.all([
    supabase.from("shop_kol_post_tags").select("post_id").eq("tag_id", tag.id),
    productIds.length ? supabase.from("shop_kol_post_products").select("post_id").in("product_id", productIds) : { data: [] },
  ]);
  const kolIds = [...new Set([...(kolLinks || []).map((row) => row.post_id), ...(kolProductLinks || []).map((row) => row.post_id)].filter(Boolean))];
  const { data: kolPosts } = kolIds.length
    ? await supabase.from("shop_kol_posts").select("id, slug, source_type, content_type, published_at, published_revision_id").eq("status", "published").in("id", kolIds).order("published_at", { ascending: false }).limit(20)
    : { data: [] };
  const revisionIds = (kolPosts || []).map((p) => p.published_revision_id).filter(Boolean);
  const { data: revisions } = revisionIds.length
    ? await supabase.from("shop_kol_post_revisions").select("id, title, body").in("id", revisionIds)
    : { data: [] };
  const revisionById = Object.fromEntries((revisions || []).map((r) => [r.id, r]));

  const { data: blogTag } = await supabase.from("blog_tags").select("id").eq("slug", tag.slug).maybeSingle();
  const { data: blogLinks } = blogTag?.id
    ? await supabase.from("blog_post_tags").select("post_id").eq("tag_id", blogTag.id)
    : { data: [] };
  const blogIds = [...new Set((blogLinks || []).map((row) => row.post_id))];
  const { data: blogPosts } = blogIds.length
    ? await supabase.from("blog_posts").select("id, slug, headline, published_at").eq("published", true).in("id", blogIds).order("published_at", { ascending: false }).limit(20)
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/shop/tags" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; All tags</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">{tag.name}</h1>
      {tag.description ? <p className="mt-2 text-sm text-[#7a5c4e]">{tag.description}</p> : null}
      <link rel="canonical" href={`/shop/tags/${tag.slug}`} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Products</h2>
        <ShopProductsPanel products={products} coverByProduct={coverByProduct} categoriesRow1={[]} categoriesRow2={[]} longevityLabels={[]} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Verified reviews</h2>
        {!(reviews || []).length ? <p className="mt-2 text-sm text-[#7a5c4e]">No verified reviews with this tag yet.</p> : (
          <ul className="mt-3 space-y-3">
            {(reviews || []).map((review) => (
              <li key={review.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
                <p className="text-sm font-semibold text-[#c77e10]">{review.rating}/5</p>
                {review.product?.slug ? <Link href={`/shop/p/${review.product.slug}`} className="text-sm font-semibold text-[#c45c26] hover:underline">{review.product.name}</Link> : null}
                {review.title ? <p className="mt-1 font-semibold text-[#3b2a22]">{review.title}</p> : null}
                <p className="mt-1 line-clamp-4 text-sm text-[#3b2a22]">{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Education & community posts</h2>
        {!(kolPosts || []).length ? <p className="mt-2 text-sm text-[#7a5c4e]">No published KOL posts with this tag yet.</p> : (
          <ul className="mt-3 space-y-3">
            {(kolPosts || []).map((post) => {
              const revision = revisionById[post.published_revision_id] || {};
              const href = `/shop/reviews/${post.slug || post.id}`;
              return (
                <li key={post.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
                  <Link href={href} className="font-semibold text-[#c45c26] hover:underline">{revision.title || "KOL post"}</Link>
                  <p className="mt-1 text-xs uppercase tracking-wide text-[#7a5c4e]">{post.source_type === "verified_purchase" ? "Verified purchase" : "Community"} · {post.content_type}</p>
                  {revision.body ? <p className="mt-2 line-clamp-3 text-sm text-[#3b2a22]">{revision.body}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3b2a22]">Blog</h2>
        {!(blogPosts || []).length ? <p className="mt-2 text-sm text-[#7a5c4e]">No blog posts with this tag yet.</p> : (
          <ul className="mt-3 space-y-2">
            {(blogPosts || []).map((post) => (
              <li key={post.id}>
                <Link href={`/blog/${post.slug}`} className="font-semibold text-[#c45c26] hover:underline">{post.headline}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
