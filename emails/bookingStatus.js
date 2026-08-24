import { buttonHtml, emailLayout, escapeHtml } from "./layout";

const COPY = {
  accepted: {
    customer: { title: "Your booking was accepted", subject: (n) => `${n} accepted your booking` },
    sitter: { title: "You accepted a booking", subject: () => "Booking accepted" },
  },
  declined: {
    customer: { title: "Your booking was declined", subject: (n) => `${n} declined your booking` },
    sitter: { title: "You declined a booking", subject: () => "Booking declined" },
  },
  canceled: {
    customer: { title: "A booking was canceled", subject: () => "Booking canceled" },
    sitter: { title: "A booking was canceled", subject: () => "Booking canceled" },
  },
};

export function renderBookingStatus({ role, status, sitterName, customerName, serviceLabel, whenLabel, href }) {
  const key = ["accepted", "declined", "canceled", "cancelled"].includes(status) ? (status === "cancelled" ? "canceled" : status) : "accepted";
  const pack = COPY[key]?.[role] || COPY.accepted.customer;
  const who = role === "sitter" ? customerName : sitterName;
  const title = pack.title;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
      <strong>${escapeHtml(serviceLabel || "Booking")}</strong> is now <strong>${escapeHtml(key)}</strong>${who ? ` (${escapeHtml(who)})` : ""}.
    </p>
    ${whenLabel ? `<p style="margin:0;font-size:14px;color:#7a5c4e;">${escapeHtml(whenLabel)}</p>` : ""}
    ${buttonHtml(href, "Open booking")}
  `;
  return {
    subject: pack.subject(who || "Joyful Paws"),
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}. ${whenLabel || ""} ${href}`,
  };
}
