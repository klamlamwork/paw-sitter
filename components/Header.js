import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";

// Header with chat icon for Inbox
export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e8d5c4]/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img
            src="/logo.svg"
            alt="Paw Sitter"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <span className="text-lg font-bold text-[#3d2a14]">
            Joyful<span className="text-[#c8cccf]">PAWS</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/sitters"
            className="hidden text-sm font-medium text-[#5a4018] hover:text-[#c8cccf] sm:inline"
          >
            Sitters
          </Link>
          <Link
            href="/blog"
            className="hidden text-sm font-medium text-[#5a4018] hover:text-[#c8cccf] sm:inline"
          >
            Blog
          </Link>
          <Link
            href="/shop"
            className="hidden text-sm font-medium text-[#5a4018] hover:text-[#c8cccf]"
          >
            Shop
          </Link>
          {/* Chat icon for Inbox */}
          <Link
            href="/inbox"
            aria-label="Inbox"
            title="Inbox"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5a4018] hover:bg-[#efd09a]/40 hover:text-[#3d2a14]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </Link>
          <Link
            href="/booking"
            className="hidden border border-[#efd09a] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a4018] sm:px-4 sm:py-2 sm:text-sm"
          >
            Book
          </Link>
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
