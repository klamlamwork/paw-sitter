import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-[#efd09a] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9" />
            <span className="text-lg font-bold text-[#3d2a14]">Joyful<span className="text-[#c8cccf]">PAWS</span></span>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#c77e10]">Explore</h2>
          <ul className="space-y-2 text-sm text-[#5a4018]">
            <li><Link href="/booking" className="hover:text-[#c8cccf]">Book Services</Link></li>
            <li><Link href="/shop" className="hover:text-[#c8cccf]">Shop</Link></li>
            <li><Link href="/contact" className="hover:text-[#c8cccf]">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#efd09a] py-4 text-center text-xs text-black">© {year} PawSitter. All rights reserved.</div>
    </footer>
  );
}
