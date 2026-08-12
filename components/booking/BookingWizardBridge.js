"use client";
import { useMemo } from "react";
import BookingWizard from "@/components/booking/BookingWizard";
import { sortPreferredFirst } from "@/components/booking/preferredSitter";

export default function BookingWizardBridge({
  preferredSitterId = "",
  preferredSitterName = "",
  sitters = [],
  ...wizardProps
}) {
  const orderedSitters = useMemo(
    () => sortPreferredFirst(sitters, preferredSitterId),
    [sitters, preferredSitterId]
  );

  return (
    <>
      {preferredSitterId && preferredSitterName ? (
        <div className="mt-4 rounded-2xl border border-[#e8d5c4] bg-[#fff8f0] px-4 py-3 text-sm text-[#5c4033]">
          Booking for <strong>{preferredSitterName}</strong>. They will appear first on the Sitter step
          when they match your location, service, and times — tap their card to confirm. You can still
          choose someone else.
        </div>
      ) : preferredSitterId ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That sitter is not available or inactive. Continue to choose another sitter.
        </div>
      ) : null}
      <BookingWizard
        {...wizardProps}
        sitters={orderedSitters}
        preferredSitterId={preferredSitterId || ""}
      />
    </>
  );
}
