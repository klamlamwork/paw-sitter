import { notFound } from "next/navigation";
import { getInviteByToken, loadReviewContext } from "@/lib/reviews";
import ReviewForm from "./ReviewForm";

export const metadata = { title: "Write a review | Paw Sitter" };

export default async function ReviewPage({ params }) {
  const { token } = await params;
  const found = await getInviteByToken(token);
  if (!found) notFound();
  const ctx = await loadReviewContext(found.invite, found.role);
  if (!ctx) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-[#3b2a22]">
        {found.role === "customer" ? "Review your sitter" : "Review the pets you cared for"}
      </h1>
      <p className="mt-2 text-sm text-[#7a5c4e]">
        {found.role === "customer"
          ? `Share stars and a short note about ${ctx.sitter?.display_name || "this sitter"}. An admin will publish it after review.`
          : "Write a short public note for each pet. An admin will publish it after review."}
      </p>
      <ReviewForm
        token={token}
        role={found.role}
        sitterName={ctx.sitter?.display_name || "Sitter"}
        pets={ctx.pets}
        existingSitterReview={ctx.sitterReview}
        existingPetReviews={ctx.petReviews}
      />
    </div>
  );
}
