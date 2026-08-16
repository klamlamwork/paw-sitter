import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function token() {
  return randomBytes(24).toString("hex");
}

function lastSlotEnd(slots) {
  let max = 0;
  for (const slot of slots || []) {
    const t = new Date(slot.ends_at || slot.starts_at || 0).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max || null;
}

async function customerEmail(admin, customerId) {
  if (!customerId) return "";
  try {
    const { data } = await admin.auth.admin.getUserById(customerId);
    return data?.user?.email || "";
  } catch {
    return "";
  }
}

export async function getInviteByToken(rawToken) {
  const value = String(rawToken || "").trim();
  if (!value) return null;
  const admin = createAdminClient();
  const { data: byCustomer } = await admin.from("review_invites").select("*").eq("customer_token", value).maybeSingle();
  if (byCustomer) return { invite: byCustomer, role: "customer" };
  const { data: bySitter } = await admin.from("review_invites").select("*").eq("sitter_token", value).maybeSingle();
  if (bySitter) return { invite: bySitter, role: "sitter" };
  return null;
}

export async function loadReviewContext(invite, role) {
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, sitter_id, service_type, status, sitters(id, display_name), booking_pets(pet_id, pets(id, name, species, photo_url, breed))")
    .eq("id", invite.booking_id)
    .maybeSingle();
  if (!booking) return null;

  const pets = (booking.booking_pets || []).map((row) => row.pets).filter(Boolean);
  const { data: sitterReview } = await admin.from("sitter_reviews").select("id, rating, body, status").eq("booking_id", booking.id).maybeSingle();
  const { data: petReviews } = await admin.from("pet_reviews").select("id, pet_id, body, status").eq("booking_id", booking.id);

  return {
    role,
    invite,
    booking,
    sitter: booking.sitters || null,
    pets,
    sitterReview: sitterReview || null,
    petReviews: petReviews || [],
  };
}

export async function requestReviewsForCompletedBookings() {
  const admin = createAdminClient();
  const { data: bookings, error } = await admin
    .from("bookings")
    .select("id, status, payment_status, customer_id, sitter_id, service_type, sitters(display_name, invite_email), booking_slots(starts_at)")
    .in("status", ["accepted", "completed"])
    .in("payment_status", ["paid", "authorized"]);
  if (error) throw error;

  const due = [];
  for (const booking of bookings || []) {
    const ended = lastSlotEnd(booking.booking_slots);
    if (ended && ended < Date.now()) due.push({ ...booking, service_ended_at: new Date(ended).toISOString() });
  }

  const created = [];
  const emailed = [];
  const skipped = [];

  for (const booking of due) {
    let { data: invite } = await admin.from("review_invites").select("*").eq("booking_id", booking.id).maybeSingle();
    if (!invite) {
      const insert = await admin
        .from("review_invites")
        .insert({
          booking_id: booking.id,
          customer_token: token(),
          sitter_token: token(),
          service_ended_at: booking.service_ended_at,
        })
        .select("*")
        .single();
      if (insert.error) throw insert.error;
      invite = insert.data;
      created.push(booking.id);
      await admin.from("bookings").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", booking.id);
    }

    const origin = siteUrl();
    const sitterName = booking.sitters?.display_name || "your sitter";
    const customerLink = `${origin}/review/${invite.customer_token}`;
    const sitterLink = `${origin}/review/${invite.sitter_token}`;

    if (!invite.customer_emailed_at) {
      const to = await customerEmail(admin, booking.customer_id);
      const sent = await sendEmail({
        to,
        subject: `How was your stay with ${sitterName}?`,
        text: `Please review ${sitterName}: ${customerLink}`,
        html: `<p>Your paid booking has finished.</p><p>Please leave a star rating and a short review for <strong>${sitterName}</strong>.</p><p><a href="${customerLink}">Write your review</a></p>`,
      });
      if (sent.ok) {
        await admin.from("review_invites").update({ customer_emailed_at: new Date().toISOString() }).eq("id", invite.id);
        emailed.push(`customer:${booking.id}`);
      } else skipped.push(`customer:${booking.id}:${sent.reason || "email failed"}`);
    }

    if (!invite.sitter_emailed_at) {
      const to = booking.sitters?.invite_email || "";
      const sent = await sendEmail({
        to,
        subject: "Please review the pets you just cared for",
        text: `Please review the pets from this booking: ${sitterLink}`,
        html: `<p>This paid booking has finished.</p><p>Please write a short note for each pet you cared for.</p><p><a href="${sitterLink}">Review the pets</a></p>`,
      });
      if (sent.ok) {
        await admin.from("review_invites").update({ sitter_emailed_at: new Date().toISOString() }).eq("id", invite.id);
        emailed.push(`sitter:${booking.id}`);
      } else skipped.push(`sitter:${booking.id}:${sent.reason || "email failed"}`);
    }
  }

  return { due: due.length, created: created.length, emailed, skipped };
}
