import Link from "next/link";

export const metadata = { title: "Booking confirmation | Paw Sitter" };

export default function EtransferConfirmationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-[#e8d5c4] bg-[#fff8f0] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[#3b2a22]">Thank you for your booking confirmation.</h1>
        <p className="mt-4 text-[#5c4033]">E-transfer Payment details will be sent to your registered email shortly.</p>
        <Link href="/account" className="mt-7 inline-flex rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white">View my bookings</Link>
      </div>
    </div>
  );
}
