"use client";

import { usePathname } from "next/navigation";
import ReviewActionsList from "@/components/booking/ReviewActionsList";

export default function AccountReviewMount() {
  const pathname = usePathname();
  if (pathname !== "/account") return null;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
      <ReviewActionsList role="customer" label="Review sitter" />
    </div>
  );
}
