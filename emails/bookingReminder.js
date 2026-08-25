import { buttonHtml, emailLayout, escapeHtml } from "./layout";

export function renderBookingReminder({ sitterName, serviceLabel, whenLabel, href }) {
  const title = "Your sitting is tomorrow";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
      Reminder: <strong>${escapeHtml(serviceLabel || "your booking")}</strong> with <strong>${escapeHtml(sitterName || "your sitter")}</strong>.
    </p>
    ${whenLabel ? `<p style="margin:0;font-size:14px;color:#7a5c4e;">${escapeHtml(whenLabel)}</p>` : ""}
    ${buttonHtml(href, "View booking")}
  `;
  return {
    subject: `Reminder: ${serviceLabel || "sitting"} tomorrow`,
    html: emailLayout({ title, preview: title, bodyHtml }),
    text: `${title}. ${whenLabel || ""} ${href}`,
  };
}
