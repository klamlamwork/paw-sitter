import Image from "next/image";
import Link from "next/link";

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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.svg"
            alt="Paw Sitter logo"
            width={44}
            height={44}
            priority
            className="h-10 w-10 sm:h-11 sm:w-11"
          />
          <span className="text-lg font-bold tracking-tight text-[#3b2a22] sm:text-xl">
            Paw <span className="text-[#c45c26]">Sitter</span>
          </span>
        </Link>

        {/* Desktop menu */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#5c4033] transition hover:bg-[#f3e0d0] hover:text-[#c45c26]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/booking"
          className="hidden rounded-full bg-[#c45c26] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a4519] md:inline-flex"
        >
          Book now
        </Link>

        {/* Mobile simple menu: horizontal scroll so it works on small phones */}
        <nav
          className="flex max-w-[55%] gap-1 overflow-x-auto md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Mobile"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full bg-[#f3e0d0] px-3 py-1.5 text-xs font-medium text-[#5c4033]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}