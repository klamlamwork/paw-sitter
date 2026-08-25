import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, siteUrl } from "@/lib/email";
import { renderBookingRequested } from "@/emails/bookingRequested";
import { renderBookingStatus } from "@/emails/bookingStatus";
import { renderBookingReminder } from "@/emails/bookingReminder";
import { renderSitterDaily } from "@/emails/sitterDaily";
import { renderOrderReceipt } from "@/emails/orderReceipt";
import { renderOrderStatus } from "@/emails/orderStatus";

function serviceLabel(type) {
  return ({ house_sit: "House sit", drop_in: "Drop-in", walking: "Walking", boarding: "Boarding" })[type] || type || "Booking";
}

function whenLabel(slots) {
  const first = (slots || [])[0];
  if (!first?.starts_at) return "";
  return new Date(first.starts_at).toLocaleString();
}

function shipLabel(order) {
  return [order.shipping_name, order.shipping_line1, order.shipping_city, order.shipping_state, order.shipping_postal_code, order.shipping_country].filter(Boolean).join(", ");
}

async function prefsFor(admin, profileId) {
  if (!profileId) return { email_transactional: true, notify_booking_updates: true, notify_order_updates: true, notify_reminders: true };
  const { data } = await admin
    .from("profiles")
    .select("email_transactional, notify_booking_updates, notify_order_updates, notify_reminders, sms_opt_in")
    .eq("id", profileId)
    .maybeSingle();
  return {
    email_transactional: data?.email_transactional !== false,
    notify_booking_updates: data?.notify_booking_updates !== false,
    notify_order_updates: data?.notify_order_updates !== false,
    notify_reminders: data?.notify_reminders !== false,
    sms_opt_in: !!data?.sms_opt_in,
  };
}

async function userEmail(admin, userId) {
  if (!userId) return "";
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
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
  const customerTo = await userEmail(admin, booking.customer_id);
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

export async function notifyOrderChange({ record, oldRecord, type }) {
  if (!record?.id) return { skipped: true, reason: "no order" };
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("shop_orders")
    .select("id, status, payment_status, user_id, seller_shop_id, shipping_name, shipping_email, shipping_line1, shipping_city, shipping_state, shipping_postal_code, shipping_country, shop:shop_shops!seller_shop_id(id, name, owner_profile_id), items:shop_order_items(id, qty, price_cents, currency, product:shop_products(name))")
    .eq("id", record.id)
    .maybeSingle();
  if (!order) return { skipped: true, reason: "order missing" };

  const origin = siteUrl();
  const shopName = order.shop?.name || "Shop";
  const items = (order.items || []).map((item) => ({
    name: item.product?.name || "Item",
    qty: item.qty,
    price_cents: item.price_cents,
    currency: item.currency,
  }));
  const totalCents = items.reduce((sum, item) => sum + Number(item.price_cents || 0) * Number(item.qty || 0), 0);
  const currency = items[0]?.currency || "CAD";
  const customerTo = order.shipping_email || (await userEmail(admin, order.user_id));
  const sellerTo = await userEmail(admin, order.shop?.owner_profile_id);
  const customerPrefs = await prefsFor(admin, order.user_id);
  const sellerPrefs = await prefsFor(admin, order.shop?.owner_profile_id);
  const hrefCustomer = `${origin}/shop/orders`;
  const hrefSeller = `${origin}/account/shop/orders`;
  const status = String(order.status || "");
  const prevStatus = String(oldRecord?.status || "");
  const pay = String(order.payment_status || "");
  const prevPay = String(oldRecord?.payment_status || "");
  const results = [];

  const isNew = type === "INSERT";
  if (isNew) {
    results.push(await dispatchEmail(admin, {
      eventKey: `order:${order.id}:created:customer`,
      to: customerTo,
      template: "orderReceipt",
      prefsOk: customerPrefs.email_transactional && customerPrefs.notify_order_updates,
      rendered: renderOrderReceipt({ role: "customer", shopName, orderId: order.id, items, totalCents, currency, shipLabel: shipLabel(order), href: hrefCustomer }),
    }));
    results.push(await dispatchEmail(admin, {
      eventKey: `order:${order.id}:created:seller`,
      to: sellerTo,
      template: "orderReceipt",
      prefsOk: sellerPrefs.email_transactional && sellerPrefs.notify_order_updates,
      rendered: renderOrderReceipt({ role: "seller", shopName, orderId: order.id, items, totalCents, currency, shipLabel: shipLabel(order), href: hrefSeller }),
    }));
  }

  if (type === "UPDATE" && prevPay && prevPay !== pay && pay === "paid") {
    results.push(await dispatchEmail(admin, {
      eventKey: `order:${order.id}:paid:customer`,
      to: customerTo,
      template: "orderReceipt",
      prefsOk: customerPrefs.email_transactional && customerPrefs.notify_order_updates,
      rendered: renderOrderReceipt({ role: "customer", shopName, orderId: order.id, items, totalCents, currency, shipLabel: shipLabel(order), href: hrefCustomer }),
    }));
  }

  if (type === "UPDATE" && prevStatus && prevStatus !== status) {
    const customerStatuses = ["accepted", "shipped", "ready", "ready_for_pickup", "delivered", "declined", "canceled", "cancelled"];
    if (customerStatuses.includes(status)) {
      results.push(await dispatchEmail(admin, {
        eventKey: `order:${order.id}:${status}:customer`,
        to: customerTo,
        template: "orderStatus",
        prefsOk: customerPrefs.email_transactional && customerPrefs.notify_order_updates,
        rendered: renderOrderStatus({ role: "customer", status, shopName, orderId: order.id, href: hrefCustomer }),
      }));
    }
    if (["canceled", "cancelled", "declined"].includes(status)) {
      results.push(await dispatchEmail(admin, {
        eventKey: `order:${order.id}:${status}:seller`,
        to: sellerTo,
        template: "orderStatus",
        prefsOk: sellerPrefs.email_transactional && sellerPrefs.notify_order_updates,
        rendered: renderOrderStatus({ role: "seller", status, shopName, orderId: order.id, href: hrefSeller }),
      }));
    }
  }

  return results.length ? { ok: true, results } : { skipped: true, reason: "no matching order event" };
}

export async function runScheduledNotifications() {
  const admin = createAdminClient();
  const origin = siteUrl();
  const now = Date.now();
  const from = new Date(now + 23 * 3600 * 1000).toISOString();
  const to = new Date(now + 25 * 3600 * 1000).toISOString();
  const results = [];

  const { data: slots } = await admin
    .from("booking_slots")
    .select("booking_id, starts_at, bookings(id, status, customer_id, service_type, sitters(display_name, invite_email, profile_id))")
    .gte("starts_at", from)
    .lte("starts_at", to);

  const seen = new Set();
  for (const slot of slots || []) {
    const booking = slot.bookings;
    if (!booking || booking.status !== "accepted" || seen.has(booking.id)) continue;
    seen.add(booking.id);
    const customerTo = await userEmail(admin, booking.customer_id);
    const prefs = await prefsFor(admin, booking.customer_id);
    results.push(await dispatchEmail(admin, {
      eventKey: `booking:${booking.id}:reminder24`,
      to: customerTo,
      template: "bookingReminder",
      prefsOk: prefs.email_transactional && prefs.notify_reminders,
      rendered: renderBookingReminder({
        sitterName: booking.sitters?.display_name,
        serviceLabel: serviceLabel(booking.service_type),
        whenLabel: new Date(slot.starts_at).toLocaleString(),
        href: `${origin}/account`,
      }),
    }));
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const horizon = new Date(now + 48 * 3600 * 1000).toISOString();
  const { data: upcoming } = await admin
    .from("booking_slots")
    .select("starts_at, bookings(id, status, sitter_id, service_type, sitters(id, display_name, invite_email, profile_id))")
    .gte("starts_at", new Date(now).toISOString())
    .lte("starts_at", horizon);

  const bySitter = new Map();
  for (const slot of upcoming || []) {
    const booking = slot.bookings;
    if (!booking || booking.status !== "accepted") continue;
    const sid = booking.sitters?.id || booking.sitter_id;
    if (!sid) continue;
    if (!bySitter.has(sid)) bySitter.set(sid, { sitter: booking.sitters, lines: [] });
    bySitter.get(sid).lines.push(`${new Date(slot.starts_at).toLocaleString()} · ${serviceLabel(booking.service_type)}`);
  }

  for (const [, group] of bySitter) {
    const prefs = await prefsFor(admin, group.sitter?.profile_id);
    results.push(await dispatchEmail(admin, {
      eventKey: `sitter-daily:${group.sitter?.id || "x"}:${dayKey}`,
      to: group.sitter?.invite_email || "",
      template: "sitterDaily",
      prefsOk: prefs.email_transactional && prefs.notify_reminders,
      rendered: renderSitterDaily({
        sitterName: group.sitter?.display_name,
        lines: group.lines.slice(0, 12),
        href: `${origin}/sitter/bookings`,
      }),
    }));
  }

  return { ok: true, results };
}
