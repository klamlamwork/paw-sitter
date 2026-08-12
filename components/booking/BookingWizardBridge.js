"use client";
import BookingWizard from "@/components/booking/BookingWizard";

export default function BookingWizardBridge({
  preferredSitterId = "",
  preferredSitterName = "",
  ...wizardProps
}) {
  return (
    <>
      {preferredSitterId && preferredSitterName ? (
        <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] px-4 py-3 text-sm text-[#5c4033]">
          Booking for <strong>{preferredSitterName}</strong>. Complete location, service, and schedule
          — they will be selected automatically when they match your area and times. You can still
          pick someone else on the Sitter step.
        </div>
      ) : preferredSitterId ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That sitter is not available or inactive. Continue to choose another sitter.
        </div>
      ) : null}
      <BookingWizard {...wizardProps} preferredSitterId={preferredSitterId || ""} />
    </>
  );
}
