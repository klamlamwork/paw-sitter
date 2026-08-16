import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { conversationIdForBooking, listInbox } from "@/lib/inbox";
import InboxList from "./InboxList";

export const metadata = { title: "Inbox | Paw Sitter" };

export default async function InboxPage({ searchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/inbox");
  const sp = await searchParams;
  const bookingId = typeof sp?.booking === "string" ? sp.booking : "";
  if (bookingId) {
    const id = await conversationIdForBooking(bookingId, profile);
    if (id) redirect(`/inbox/${id}`);
  }
  const conversations = await listInbox(profile);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">Inbox</h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">Messages with sitters and clients, newest first.</p>
      <InboxList conversations={conversations} />
    </div>
  );
}
