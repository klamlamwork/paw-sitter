import Link from "next/link";
import ReviewSlideshow from "./ReviewSlideshow";

function Cover({ item }) {
  if (!item?.url) return null;
  return (
    <div className="mt-4">
      {item.resource_type === "video" ? <video controls className="w-full rounded-2xl bg-black" src={item.url} /> : <img src={item.url} alt={item.caption || ""} className="w-full rounded-2xl object-cover" />}
      {item.caption ? <p className="mt-2 text-sm text-[#5c4033]">{item.caption}</p> : null}
    </div>
  );
}

export default function KolArticle({ post }) {
  if (!post) return null;
  return (
    <article>
      {post.author_href ? <Link href={post.author_href} className="text-sm font-semibold text-[#c45c26] hover:underline">{post.author_name}</Link> : <p className="text-sm font-semibold text-[#3b2a22]">{post.author_name}</p>}
      <Cover item={post.cover} />
      <p className="mt-3 text-xs text-[#7a5c4e]">{post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}</p>
      <h1 className="mt-2 text-3xl font-bold text-[#3b2a22]">{post.title || "Review"}</h1>
      {post.verified_badge ? <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">Verified purchase</p> : <p className="mt-1 text-xs font-semibold text-[#7a5c4e]">{post.content_type === "how_to" ? "How-to" : "Community"}</p>}
      {post.key_takeaways?.length ? (
        <div className="mt-5">
          <h2 className="text-lg font-semibold text-[#3b2a22]">Key takeaways</h2>
          <ul className="mt-2 space-y-2">{post.key_takeaways.map((row) => <li key={row} className="flex gap-2 text-sm text-[#3b2a22]"><span className="text-[#d4a017]">✓</span><span>{row}</span></li>)}</ul>
        </div>
      ) : null}
      {post.body ? <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-[#3b2a22]">{post.body}</p> : null}
      {post.slides?.length ? <ReviewSlideshow items={post.slides} /> : null}
      {(post.products || []).map((product) => (
        <section key={product.id} className="mt-8 border-t border-[#e8d5c4] pt-5">
          {product.slug ? <Link href={`/shop/p/${product.slug}`} className="text-lg font-semibold text-[#c45c26] hover:underline">{product.name}</Link> : <h2 className="text-lg font-semibold text-[#3b2a22]">{product.name}</h2>}
          {product.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#3b2a22]">{product.description}</p> : null}
          <ReviewSlideshow items={product.media || []} />
        </section>
      ))}
    </article>
  );
}
