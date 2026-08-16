import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { loadThread } from "@/lib/inbox";
import InboxThread from "./InboxThread";

export const metadata = { title: "Conversation | Paw Sitter" };

export default async function InboxThreadPage({ params }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/inbox");
  const { id } = await params;
  const thread = await loadThread(id, profile);
  if (!thread) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/inbox" className="text-sm font-semibold text-[#c45c26] hover:underline">&larr; Inbox</Link>
      <InboxThread
        conversationId={id}
        profileId={profile.id}
        otherName={thread.otherName}
        booking={thread.booking}
        initialMessages={thread.messages}
        pets={thread.pets}
        role={thread.role}
      />
    </div>
  );
}
