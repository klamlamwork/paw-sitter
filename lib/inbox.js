import { createAdminClient } from "@/lib/supabase/admin";
import { serviceLabel } from "@/lib/sitters";

function previewText(body, photoUrl) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 90);
  if (photoUrl) return "Sent a photo";
  return "";
}

function formatRange(slots) {
  const times = (slots || []).map((s) => new Date(s.starts_at || s.ends_at)).filter((d) => !Number.isNaN(d.getTime()));
  if (!times.length) return "";
  times.sort((a, b) => a - b);
  const opts = { day: "numeric", month: "short" };
  const first = times[0].toLocaleDateString("en-GB", opts);
  const last = times[times.length - 1].toLocaleDateString("en-GB", opts);
  return first === last ? first : `${first} to ${last}`;
}

function bookingIntroMessage(booking) {
  return String(booking?.customer_message || booking?.customer_notes || "").trim();
}

export function bookingServiceLine(booking) {
  const label = serviceLabel(booking?.service_type);
  const range = formatRange(booking?.booking_slots);
  return range ? `${label} | ${range}` : label;
}

export async function ensureInboxForUser(profile) {
  const admin = createAdminClient();
  const { data: sitter } = await admin.from("sitters").select("id").eq("profile_id", profile.id).maybeSingle();
  let query = admin.from("bookings").select("id, customer_id, sitter_id, customer_message, customer_notes, created_at");
  query = sitter?.id
    ? query.or(`customer_id.eq.${profile.id},sitter_id.eq.${sitter.id}`)
    : query.eq("customer_id", profile.id);
  const { data: bookings } = await query;
  const list = bookings || [];
  if (!list.length) return [];

  const { data: existing } = await admin.from("booking_conversations").select("id, booking_id").in("booking_id", list.map((b) => b.id));
  const have = new Set((existing || []).map((row) => row.booking_id));

  for (const booking of list) {
    if (have.has(booking.id) || !booking.customer_id || !booking.sitter_id) continue;
    const intro = bookingIntroMessage(booking);
    const preview = previewText(intro) || "New booking request";
    const { data: convo } = await admin
      .from("booking_conversations")
      .insert({
        booking_id: booking.id,
        customer_id: booking.customer_id,
        sitter_id: booking.sitter_id,
        last_message_at: booking.created_at || new Date().toISOString(),
        last_message_preview: preview,
        last_sender_id: booking.customer_id,
      })
      .select("id")
      .single();
    if (convo?.id && intro) {
      await admin.from("booking_messages").insert({
        conversation_id: convo.id,
        sender_id: booking.customer_id,
        body: intro,
      });
    }
  }
  return list;
}

export async function listInbox(profile) {
  await ensureInboxForUser(profile);
  const admin = createAdminClient();
  const { data: sitter } = await admin.from("sitters").select("id").eq("profile_id", profile.id).maybeSingle();
  let query = admin
    .from("booking_conversations")
    .select("id, booking_id, customer_id, sitter_id, last_message_at, last_message_preview, last_sender_id, bookings(id, status, service_type, estimated_total, service_address, service_address_city, booking_slots(starts_at, ends_at), sitters(id, display_name, profile_pic_url, profile_id), profiles:customer_id(id, full_name, email))")
    .order("last_message_at", { ascending: false });
  query = sitter?.id
    ? query.or(`customer_id.eq.${profile.id},sitter_id.eq.${sitter.id}`)
    : query.eq("customer_id", profile.id);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => {
    const booking = row.bookings || {};
    const asCustomer = row.customer_id === profile.id;
    const otherName = asCustomer
      ? booking.sitters?.display_name || "Sitter"
      : booking.profiles?.full_name || "Customer";
    const you = row.last_sender_id === profile.id;
    const preview = row.last_message_preview || "";
    return {
      id: row.id,
      bookingId: row.booking_id,
      otherName,
      photo: asCustomer ? booking.sitters?.profile_pic_url || "" : "",
      lastLine: preview ? `${you ? "You" : otherName}: ${preview}` : "No messages yet",
      serviceLine: bookingServiceLine(booking),
      status: booking.status || "pending",
      lastAt: row.last_message_at,
      role: asCustomer ? "customer" : "sitter",
    };
  });
}

export async function loadThread(conversationId, profile) {
  const admin = createAdminClient();
  const { data: convo } = await admin
    .from("booking_conversations")
    .select("*, bookings(*, booking_slots(*), sitters(id, display_name, profile_pic_url, profile_id, service_city, service_country, timezone), profiles:customer_id(id, full_name, email, city, country, timezone))")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return null;
  const { data: mySitter } = await admin.from("sitters").select("id").eq("profile_id", profile.id).maybeSingle();
  const allowed = convo.customer_id === profile.id || (mySitter && convo.sitter_id === mySitter.id);
  if (!allowed) return null;
  const { data: messages } = await admin.from("booking_messages").select("id, sender_id, body, photo_url, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  const booking = convo.bookings || {};
  const pets = await loadBookingPets(admin, booking.id);
  return {
    conversation: convo,
    booking,
    messages: messages || [],
    pets,
    role: convo.customer_id === profile.id ? "customer" : "sitter",
    otherName: convo.customer_id === profile.id ? booking.sitters?.display_name || "Sitter" : booking.profiles?.full_name || "Customer",
  };
}

export async function loadBookingPets(admin, bookingId) {
  if (!bookingId) return [];
  const { data: links } = await admin.from("booking_pets").select("pet_id").eq("booking_id", bookingId);
  const petIds = [...new Set((links || []).map((row) => row.pet_id).filter(Boolean))];
  if (!petIds.length) return [];
  const [{ data: pets }, { data: reviews }] = await Promise.all([
    admin.from("pets").select("id, name, species, breed, weight_lbs, age_years, age_months, sex, is_spayed_neutered, medications, notes, photo_url").in("id", petIds),
    admin.from("pet_reviews").select("id, pet_id, body, published_at, sitters(display_name)").in("pet_id", petIds).eq("status", "published"),
  ]);
  const byId = Object.fromEntries((pets || []).map((p) => [p.id, { ...p, reviews: [] }]));
  for (const review of reviews || []) if (byId[review.pet_id]) byId[review.pet_id].reviews.push(review);
  return petIds.map((id) => byId[id]).filter(Boolean);
}

export async function sendInboxMessage({ conversationId, profile, body, photoUrl }) {
  const admin = createAdminClient();
  const thread = await loadThread(conversationId, profile);
  if (!thread) throw new Error("Conversation not found.");
  const text = String(body || "").trim();
  if (!text && !photoUrl) throw new Error("Write a message or attach a photo.");
  const { data, error } = await admin
    .from("booking_messages")
    .insert({ conversation_id: conversationId, sender_id: profile.id, body: text || null, photo_url: photoUrl || null })
    .select("id, sender_id, body, photo_url, created_at")
    .single();
  if (error) throw error;
  await admin
    .from("booking_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: previewText(text, photoUrl),
      last_sender_id: profile.id,
    })
    .eq("id", conversationId);
  return data;
}

export async function conversationIdForBooking(bookingId, profile) {
  await ensureInboxForUser(profile);
  const admin = createAdminClient();
  const { data } = await admin.from("booking_conversations").select("id").eq("booking_id", bookingId).maybeSingle();
  return data?.id || "";
}
