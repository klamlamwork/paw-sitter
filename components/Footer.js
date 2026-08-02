import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#e8d5c4] bg-[#fff8f0]/95">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9" />
            <span className="text-lg font-bold text-[#3b2a22]">
              Paw <span className="text-[#c45c26]">Sitter</span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[#7a5c4e]">
            Warm, reliable pet sitting for dogs and cats. Walks, feeding, and
            peace of mind while you are away.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#c45c26]">
            Explore
          </h2>
          <ul className="space-y-2 text-sm text-[#5c4033]">
            <li>
              <Link href="/services" className="hover:text-[#c45c26]">
                Services
              </Link>
            </li>
            <li>
              <Link href="/booking" className="hover:text-[#c45c26]">
                Booking
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-[#c45c26]">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-[#c45c26]">
                Shop
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#c45c26]">
            Contact
          </h2>
          <p className="text-sm text-[#7a5c4e]">Cambridge &amp; area, Ontario</p>
          <p className="mt-1 text-sm text-[#7a5c4e]">
            Email:{" "}
            <a
              href="mailto:hello@pawsitter.example"
              className="font-medium text-[#c45c26] hover:underline"
            >
              hello@pawsitter.example
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-[#e8d5c4] py-4 text-center text-xs text-[#7a5c4e]">
        © {year} Paw Sitter. All rights reserved.
      </div>
    </footer>
  );
}