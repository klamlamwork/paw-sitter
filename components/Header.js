import Image from "next/image";
import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/booking", label: "Booking" },
  { href: "/blog", label: "Blog" },
  { href: "/shop", label: "Shop" },
  { href: "/contact", label: "Contact" },
];
export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e8d5c4]/90 bg-[#fff8f0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image src="/logo.svg" alt="Paw Sitter logo" width={44} height={44} priority className="h-10 w-10" />
          <span className="text-lg font-bold text-[#3b2a22]">
            Paw <span className="text-[#c45c26]">Sitter</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-[#5c4033] hover:bg-[#f3e0d0] hover:text-[#c45c26]">
              {l.label}
            </Link>
          ))}
        </nav>
        <AuthButtons />
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-[#f0e0d2] px-4 py-2 md:hidden">
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-full bg-[#f3e0d0] px-3 py-1.5 text-xs font-medium text-[#5c4033]">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
