import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FIELDS = [
  "email_transactional",
  "email_marketing",
  "sms_opt_in",
  "notify_booking_updates",
  "notify_order_updates",
  "notify_reminders",
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select(FIELDS.join(",")).eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    email_transactional: data?.email_transactional !== false,
    email_marketing: !!data?.email_marketing,
    sms_opt_in: !!data?.sms_opt_in,
    notify_booking_updates: data?.notify_booking_updates !== false,
    notify_order_updates: data?.notify_order_updates !== false,
    notify_reminders: data?.notify_reminders !== false,
  });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json();
  const patch = {};
  for (const key of FIELDS) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
