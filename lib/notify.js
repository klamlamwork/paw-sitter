import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, siteUrl } from "@/lib/email";
import { renderBookingRequested } from "@/emails/bookingRequested";
import { renderBookingStatus } from "@/emails/bookingStatus";

function serviceLabel(type) {
  return ({ house_sit: "House sit", drop_in: "Drop-in", walking: "Walking", boarding: "Boarding" })[type] || type || "Booking";
}

function whenLabel(slots) {
  const first = (slots || [])[0];
  if (!first?.starts_at) return "";
  return new Date(first.starts_at).toLocaleString();
}

async function prefsFor(admin, profileId) {
  if (!profileId) return { email_transactional: true, notify_booking_updates: true };
  const { data } = await admin
    .from("profiles")
    .select("email_transactional, notify_booking_updates, sms_opt_in")
    .eq("id", profileId)
    .maybeSingle();
  return {
    email_transactional: data?.email_transactional !== false,
    notify_booking_updates: data?.notify_booking_updates !== false,
    sms_opt_in: !!data?.sms_opt_in,
  };
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

async function alreadySent(admin, eventKey, recipient) {
  const { data } = await admin
    .from("notification_log")
    .select("id")
    .eq("event_key", eventKey)
    .eq("channel", "email")
    .eq("recipient", recipient)
    .maybeSingle();
  return !!data;
}

async function logSend(admin, { eventKey, recipient, intended, template, status, detail }) {
  await admin.from("notification_log").insert({
    event_key: eventKey,
    channel: "email",
    recipient,
    intended_recipient: intended || recipient,
    template,
    status,
    detail: detail || null,
  });
}

async function dispatchEmail(admin, { eventKey, to, template, rendered, prefsOk }) {
  if (!prefsOk) return { skipped: true, reason: "prefs off" };
  if (!to) return { skipped: true, reason: "no recipient" };
  if (await alreadySent(admin, eventKey, to).catch(() => false)) {
    return { skipped: true, reason: "duplicate" };
  }
  try {
    const sent = await sendEmail({ to, ...rendered });
    if (sent.skipped) {
      await logSend(admin, { eventKey, recipient: to, intended: sent.intended || to, template, status: "skipped", detail: sent.reason }).catch(() => {});
      return sent;
    }
    await logSend(admin, { eventKey, recipient: sent.to, intended: sent.intended || to, template, status: "sent" }).catch(() => {});
    return sent;
  } catch (err) {
    await logSend(admin, { eventKey, recipient: to, intended: to, template, status: "error", detail: err.message }).catch(() => {});
    throw err;
  }
}

export async function notifyBookingChange({ record, oldRecord, type }) {
  if (!record?.id) return { skipped: true, reason: "no booking" };
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, customer_id, sitter_id, service_type, sitters(id, display_name, invite_email, profile_id), booking_slots(starts_at, ends_at)")
    .eq("id", record.id)
    .maybeSingle();
  if (!booking) return { skipped: true, reason: "booking missing" };

  const origin = siteUrl();
  const hrefCustomer = `${origin}/account`;
  const hrefSitter = `${origin}/sitter/bookings`;
  const label = serviceLabel(booking.service_type);
  const when = whenLabel(booking.booking_slots);
  const sitterName = booking.sitters?.display_name || "your sitter";
  const customerTo = await customerEmail(admin, booking.customer_id);
  const sitterTo = booking.sitters?.invite_email || "";
  const customerPrefs = await prefsFor(admin, booking.customer_id);
  const sitterPrefs = await prefsFor(admin, booking.sitters?.profile_id);

  let customerName = "A customer";
  if (booking.customer_id) {
    const { data: cprof } = await admin.from("profiles").select("full_name").eq("id", booking.customer_id).maybeSingle();
    if (cprof?.full_name) customerName = cprof.full_name;
  }

  const status = String(booking.status || "");
  const prev = String(oldRecord?.status || "");
  const results = [];

  const isNew = type === "INSERT" || (type === "UPDATE" && !prev && status === "pending");
  const statusChanged = type === "UPDATE" && prev && prev !== status;

  if (isNew && status === "pending") {
    results.push(await dispatchEmail(admin, {
      eventKey: `booking:${booking.id}:requested:customer`,
      to: customerTo,
      template: "bookingRequested",
      prefsOk: customerPrefs.email_transactional && customerPrefs.notify_booking_updates,
      rendered: renderBookingRequested({ role: "customer", sitterName, customerName, serviceLabel: label, whenLabel: when, href: hrefCustomer }),
    }));
    results.push(await dispatchEmail(admin, {
      eventKey: `booking:${booking.id}:requested:sitter`,
      to: sitterTo,
      template: "bookingRequested",
      prefsOk: sitterPrefs.email_transactional && sitterPrefs.notify_booking_updates,
      rendered: renderBookingRequested({ role: "sitter", sitterName, customerName, serviceLabel: label, whenLabel: when, href: hrefSitter }),
    }));
    return { ok: true, event: "requested", results };
  }

  if (statusChanged && ["accepted", "declined", "canceled", "cancelled"].includes(status)) {
    const norm = status === "cancelled" ? "canceled" : status;
    results.push(await dispatchEmail(admin, {
      eventKey: `booking:${booking.id}:${norm}:customer`,
      to: customerTo,
      template: "bookingStatus",
      prefsOk: customerPrefs.email_transactional && customerPrefs.notify_booking_updates,
      rendered: renderBookingStatus({ role: "customer", status: norm, sitterName, customerName, serviceLabel: label, whenLabel: when, href: hrefCustomer }),
    }));
    if (norm === "canceled") {
      results.push(await dispatchEmail(admin, {
        eventKey: `booking:${booking.id}:${norm}:sitter`,
        to: sitterTo,
        template: "bookingStatus",
        prefsOk: sitterPrefs.email_transactional && sitterPrefs.notify_booking_updates,
        rendered: renderBookingStatus({ role: "sitter", status: norm, sitterName, customerName, serviceLabel: label, whenLabel: when, href: hrefSitter }),
      }));
    }
    return { ok: true, event: norm, results };
  }

  return { skipped: true, reason: "no matching booking event" };
}
