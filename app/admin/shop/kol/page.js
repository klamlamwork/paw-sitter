import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { pendingKolForAdmin } from "@/lib/kolPublic";
import KolArticle from "@/app/shop/KolArticle";
import KolRequestChanges from "./KolRequestChanges";
import KolPublish from "./KolPublish";

export const dynamic = "force-dynamic";
export const metadata = { title: "KOL review queue | Paw Sitter" };

export default async function AdminKolQueuePage() {
  const profile = await requireRole("admin");
  if (!profile) redirect("/login?next=/admin/shop/kol");
  const list = await pendingKolForAdmin();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/admin/shop" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Shop admin</Link>
      <h1 className="mt-4 text-3xl font-bold text-[#3b2a22]">KOL review queue</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Preview matches the public post. Approve & publish makes it live; Request changes returns it to the creator.</p>
      {!list.length ? <p className="mt-8 rounded-2xl border border-[#e8d5c4] bg-white p-5 text-sm text-[#7a5c4e]">No KOL media reviews are waiting for review.</p> : null}
      <div className="mt-8 space-y-8">
        {list.map((post) => (
          <div key={post.id} className="rounded-2xl border border-[#e8d5c4] bg-white p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#c45c26]">{post.source_type === "verified_purchase" ? "Verified purchase" : "Community"} · pending admin</p>
            <KolArticle post={post} />
            <KolPublish postId={post.id} />
            <KolRequestChanges postId={post.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
