import { buttonHtml, emailLayout, escapeHtml } from "./layout";

export function renderBookingRequested({ role, sitterName, customerName, serviceLabel, whenLabel, href }) {
  const forSitter = role === "sitter";
  const title = forSitter ? "New booking request" : "We sent your booking request";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${
      forSitter
        ? `${escapeHtml(customerName || "A customer")} requested <strong>${escapeHtml(serviceLabel || "a sitting")}</strong>.`
        : `Your request for <strong>${escapeHtml(serviceLabel || "a sitting")}</strong> was sent to <strong>${escapeHtml(sitterName || "your sitter")}</strong>.`
    }</p>
    ${whenLabel ? `<p style="margin:0;font-size:14px;color:#7a5c4e;">${escapeHtml(whenLabel)}</p>` : ""}
    ${buttonHtml(href, forSitter ? "Review request" : "View booking")}
  `;
  return {
    subject: forSitter ? `New booking request from ${customerName || "a customer"}` : `Booking request sent to ${sitterName || "your sitter"}`,
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}. ${whenLabel || ""} ${href}`,
  };
}
