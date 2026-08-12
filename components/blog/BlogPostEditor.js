"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/blog";

function hasId(list, id) {
  const sid = String(id);
  return (list || []).some((x) => String(x) === sid);
}

export default function BlogPostEditor({
  mode = "create",
  post = null,
  allTags = [],
  allProducts = [],
  allPosts = [],
  initialTagIds = [],
  initialProductIds = [],
  initialRelatedIds = [],
  authorId,
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(post?.headline || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!post?.slug);
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url || "");
  const [contentHtml, setContentHtml] = useState(post?.content_html || "");
  const [published, setPublished] = useState(!!post?.published);
  const [tagIds, setTagIds] = useState(initialTagIds || []);
  const [productIds, setProductIds] = useState(initialProductIds || []);
  const [relatedIds, setRelatedIds] = useState(initialRelatedIds || []);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const otherPosts = useMemo(
    () => (allPosts || []).filter((p) => String(p.id) !== String(post?.id)),
    [allPosts, post?.id]
  );
  const coverPreview = coverImageUrl.trim();

  function onHeadline(v) {
    setHeadline(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function toggleId(list, setList, id) {
    const sid = String(id);
    if (hasId(list, sid)) setList(list.filter((x) => String(x) !== sid));
    else setList([...list, id]);
  }

  async function writePost(supabase, body, postId) {
    if (mode === "create") {
      return supabase.from("blog_posts").insert(body).select("*").single();
    }
    if (!postId) {
      return { data: null, error: { message: "Missing post id for update." } };
    }
    return supabase.from("blog_posts").update(body).eq("id", postId).select("*").single();
  }

  async function save() {
    setSaving(true);
    setError("");
    setOk("");

    if (!headline.trim()) {
      setError("Headline is required.");
      setSaving(false);
      return;
    }
    const s = slugify(slug || headline);
    if (!s) {
      setError("Slug is required.");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("You are not signed in. Refresh and log in again.");

      const cover = coverImageUrl.trim();
      const basePayload = {
        headline: headline.trim(),
        slug: s,
        content_html: contentHtml ?? "",
        published: !!published,
        published_at: published ? post?.published_at || new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        author_id: authorId || post?.author_id || user.id || null,
      };

      let postId = post?.id || null;
      let saved = null;
      let coverSkipped = false;

      // 1) Try with cover column
      {
        const payload = { ...basePayload, cover_image_url: cover };
        const { data, error: err } = await writePost(supabase, payload, postId);
        if (!err && data) {
          saved = data;
          postId = data.id;
        } else if (err && /cover_image_url/i.test(err.message || "")) {
          // Column missing or schema cache stale — save core fields without cover
          coverSkipped = true;
          const { data: data2, error: err2 } = await writePost(supabase, basePayload, postId);
          if (err2) throw err2;
          if (!data2) throw new Error("Save failed: no row returned (check admin role / RLS).");
          saved = data2;
          postId = data2.id;
        } else if (err) {
          throw err;
        } else {
          throw new Error("Save failed: no row returned (check admin role / RLS).");
        }
      }

      // 2) Relations (best-effort with hard errors)
      const { error: delTagsErr } = await supabase.from("blog_post_tags").delete().eq("post_id", postId);
      if (delTagsErr) throw delTagsErr;
      if (tagIds.length) {
        const { error: tErr } = await supabase
          .from("blog_post_tags")
          .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
        if (tErr) throw tErr;
      }

      const { error: delProdErr } = await supabase.from("blog_post_products").delete().eq("post_id", postId);
      if (delProdErr) throw delProdErr;
      if (productIds.length) {
        const { error: pErr } = await supabase.from("blog_post_products").insert(
          productIds.map((product_id, i) => ({
            post_id: postId,
            product_id,
            sort_order: i,
          }))
        );
        if (pErr) throw pErr;
      }

      const { error: delRelErr } = await supabase.from("blog_post_related").delete().eq("post_id", postId);
      if (delRelErr) throw delRelErr;
      if (relatedIds.length) {
        const { error: rErr } = await supabase.from("blog_post_related").insert(
          relatedIds.map((related_post_id, i) => ({
            post_id: postId,
            related_post_id,
            sort_order: i,
          }))
        );
        if (rErr) throw rErr;
      }

      // Sync UI from DB row
      if (saved) {
        setHeadline(saved.headline || "");
        setSlug(saved.slug || "");
        setContentHtml(saved.content_html || "");
        setPublished(!!saved.published);
        if (typeof saved.cover_image_url === "string") setCoverImageUrl(saved.cover_image_url);
      }

      if (coverSkipped && cover) {
        setOk(
          "Post saved, but cover photo URL was not stored. Run sql/14-blog-cover-image.sql in Supabase, then save again."
        );
      } else {
        setOk("Saved.");
      }

      if (mode === "create") {
        router.push(`/admin/blog/${postId}`);
      }
      router.refresh();
    } catch (e) {
      const msg = e?.message || e?.error_description || "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!post?.id || !confirm("Delete this post?")) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("blog_posts").delete().eq("id", post.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{ok}</p> : null}

      <label className="block text-sm font-semibold">
        Headline
        <input
          value={headline}
          onChange={(e) => onHeadline(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 font-normal"
        />
      </label>

      <label className="block text-sm font-semibold">
        Slug
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 font-mono text-sm font-normal"
        />
        <span className="mt-1 block text-xs font-normal text-[#7a5c4e]">
          URL: /blog/{slugify(slug || headline)}
        </span>
      </label>

      <label className="block text-sm font-semibold">
        Cover photo URL
        <input
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="mt-1 w-full rounded-xl border border-[#e8d5c4] px-3 py-2 font-normal text-sm"
        />
        <span className="mt-1 block text-xs font-normal text-[#7a5c4e]">
          Optional. Requires column cover_image_url (sql/14-blog-cover-image.sql).
        </span>
      </label>
      {coverPreview ? (
        <div className="overflow-hidden rounded-xl border border-[#e8d5c4] bg-[#fff8f0]">
          <img src={coverPreview} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Content (HTML)</p>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="text-xs font-semibold text-[#c45c26]"
          >
            {preview ? "Edit HTML" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div
            className="min-h-[240px] rounded-xl border border-[#e8d5c4] bg-white p-4"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <textarea
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            rows={16}
            className="w-full rounded-xl border border-[#e8d5c4] px-3 py-2 font-mono text-sm"
            placeholder="<p>Write HTML…</p>"
          />
        )}
      </div>

      <fieldset className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Tags</legend>
        <div className="flex flex-wrap gap-3">
          {allTags.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasId(tagIds, t.id)}
                onChange={() => toggleId(tagIds, setTagIds, t.id)}
              />{" "}
              {t.name}
            </label>
          ))}
          {!allTags.length ? <p className="text-xs text-[#7a5c4e]">No tags yet.</p> : null}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Related products (sidebar / mobile bar)</legend>
        <div className="space-y-2">
          {allProducts.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasId(productIds, p.id)}
                onChange={() => toggleId(productIds, setProductIds, p.id)}
              />{" "}
              {p.title}
            </label>
          ))}
          {!allProducts.length ? <p className="text-xs text-[#7a5c4e]">No products yet.</p> : null}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[#e8d5c4] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Related posts (end of article)</legend>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {otherPosts.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasId(relatedIds, p.id)}
                onChange={() => toggleId(relatedIds, setRelatedIds, p.id)}
              />
              {p.headline}{" "}
              {!p.published ? <span className="text-xs text-[#7a5c4e]">(draft)</span> : null}
            </label>
          ))}
          {!otherPosts.length ? <p className="text-xs text-[#7a5c4e]">No other posts yet.</p> : null}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save post"}
        </button>
        <Link
          href="/admin/blog"
          className="rounded-full border border-[#e8d5c4] bg-white px-5 py-2.5 text-sm font-semibold"
        >
          Back
        </Link>
        {mode === "edit" ? (
          <button
            type="button"
            disabled={saving}
            onClick={remove}
            className="rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
