import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";
export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e8d5c4]/80 bg-[#fff8f0]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt="Paw Sitter" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <span className="truncate text-base font-bold text-[#3b2a22] sm:text-lg">Paw Sitter</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/blog" className="text-sm font-medium text-[#5c4033] hover:text-[#c45c26]">Blog</Link>
          <Link href="/booking" className="rounded-full border border-[#e8d5c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4033] sm:px-4 sm:py-2 sm:text-sm">Book</Link>
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
