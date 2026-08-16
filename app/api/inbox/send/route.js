import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadThread, sendInboxMessage } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
    const conversationId = new URL(request.url).searchParams.get("conversation_id");
    const thread = await loadThread(conversationId, profile);
    if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ messages: thread.messages });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not load messages" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ error: "Sign in." }, { status: 401 });
    const body = await request.json();
    const message = await sendInboxMessage({
      conversationId: body.conversation_id,
      profile,
      body: body.body,
      photoUrl: body.photo_url,
    });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not send" }, { status: 500 });
  }
}
