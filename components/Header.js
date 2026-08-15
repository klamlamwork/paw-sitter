import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#efd09a]/80 bg-[#fff9ed]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt="Paw Sitter" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <span className="truncate text-base font-bold text-[#3d2a14] sm:text-lg">Paw Sitter</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/sitters" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Sitters</Link>
          <Link href="/blog" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Blog</Link>
          <Link href="/shop" className="text-sm font-medium text-[#5a4018] hover:text-[#e39b2e]">Shop</Link>
          <Link href="/booking" className="border border-[#efd09a] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a4018] sm:px-4 sm:py-2 sm:text-sm">Book</Link>
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
