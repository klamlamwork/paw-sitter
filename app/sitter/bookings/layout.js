import ReviewActionsList from "@/components/booking/ReviewActionsList";

export default function SitterBookingsLayout({ children }) {
  return (
    <>
      {children}
      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <ReviewActionsList role="sitter" label="Review pets" />
      </div>
    </>
  );
}
