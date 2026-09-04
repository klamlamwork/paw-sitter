import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloudinaryImageUrl } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";
export const metadata = { title: "KOL review queue | Paw Sitter" };

function videoUrl(publicId, version) {
  const cloud = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud || !publicId) return "";
  return `https://res.cloudinary.com/${cloud}/video/upload/f_auto,q_auto${version ? `/v${version}` : ""}/${publicId}`;
}

export default async function AdminKolQueuePage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/shop/kol");
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("shop_kol_posts")
    .select("id, author_profile_id, source_type, content_type, verified_order_item_id, primary_product_id, pending_revision_id, created_at")
    .eq("status", "pending_admin")
    .order("created_at", { ascending: true });

  const list = posts || [];
  const authorIds = [...new Set(list.map((post) => post.author_profile_id).filter(Boolean))];
  const productIds = [...new Set(list.map((post) => post.primary_product_id).filter(Boolean))];
  const revisionIds = [...new Set(list.map((post) => post.pending_revision_id).filter(Boolean))];
  const [authorsResult, productsResult, revisionsResult, mediaResult, eventsResult] = await Promise.all([
    authorIds.length ? admin.from("profiles").select("id, full_name, email").in("id", authorIds) : { data: [] },
    productIds.length ? admin.from("shop_products").select("id, name, slug").in("id", productIds) : { data: [] },
    revisionIds.length ? admin.from("shop_kol_post_revisions").select("id, post_id, title, body, rating, moderation_status, moderation_reasons, submitted_at").in("id", revisionIds) : { data: [] },
    list.length ? admin.from("shop_kol_post_media").select("id, post_id, revision_id, public_id, version, resource_type, width, height, duration_seconds, sort_order").in("post_id", list.map((post) => post.id)).eq("lifecycle", "attached_private").order("sort_order") : { data: [] },
    list.length ? admin.from("kol_moderation_events").select("id, post_id, revision_id, stage, decision, reasons, score, created_at").in("post_id", list.map((post) => post.id)).order("created_at", { ascending: false }) : { data: [] },
  ]);

  const authors = Object.fromEntries((authorsResult.data || []).map((row) => [row.id, row]));
  const products = Object.fromEntries((productsResult.data || []).map((row) => [row.id, row]));
  const revisions = Object.fromEntries((revisionsResult.data || []).map((row) => [row.id, row]));
  const mediaByPost = {};
  for (const row of mediaResult.data || []) {
    if (!mediaByPost[row.post_id]) mediaByPost[row.post_id] = [];
    mediaByPost[row.post_id].push(row);
  }
  const eventsByPost = {};
  for (const row of eventsResult.data || []) {
    if (!eventsByPost[row.post_id]) eventsByPost[row.post_id] = [];
    eventsByPost[row.post_id].push(row);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">KOL review queue</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Private verified media submissions awaiting human review. This page is read-only; publishing and Paw Points are not enabled yet.</p>

      {!list.length ? <p className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white p-5 text-sm text-[#7a5c4e]">No KOL media reviews are waiting for review.</p> : null}
      <div className="mt-8 space-y-6">
        {list.map((post) => {
          const revision = revisions[post.pending_revision_id];
          const author = authors[post.author_profile_id];
          const product = products[post.primary_product_id];
          const media = mediaByPost[post.id] || [];
          const events = eventsByPost[post.id] || [];
          return (
            <article key={post.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#c45c26]">Verified purchase · media review</p>
                  <h2 className="mt-1 text-xl font-bold text-[#3b2a22]">{product?.name || "Product"}</h2>
                  <p className="mt-1 text-xs text-[#7a5c4e]">Submitted by {author?.full_name || author?.email || "Member"} · {revision?.submitted_at ? new Date(revision.submitted_at).toLocaleString() : new Date(post.created_at).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Pending admin</span>
              </div>

              {revision ? (
                <div className="mt-5 rounded-xl bg-[#fff8f0] p-4">
                  <p className="font-semibold text-[#3b2a22]">{revision.rating}/5 {revision.title || "Untitled review"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3b2a22]">{revision.body}</p>
                </div>
              ) : null}

              {media.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {media.map((asset) => asset.resource_type === "video" ? (
                    <video key={asset.id} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" src={videoUrl(asset.public_id, asset.version)} />
                  ) : (
                    <img key={asset.id} src={cloudinaryImageUrl({ publicId: asset.public_id, version: asset.version, width: 700, height: 700 })} alt="Private KOL submission" className="aspect-square w-full rounded-xl object-cover" />
                  ))}
                </div>
              ) : null}

              {events.length ? (
                <div className="mt-5 border-t border-[#e8d5c4] pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c4e]">Moderation record</p>
                  <ul className="mt-2 space-y-1 text-xs text-[#5c4033]">
                    {events.map((event) => <li key={event.id}>{event.stage}: {event.decision}{event.reasons?.length ? ` · ${event.reasons.join(", ")}` : ""}</li>)}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
