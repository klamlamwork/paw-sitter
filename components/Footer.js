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
            <span className="text-lg font-bold text-[#3d2a14]">Paw<span className="text-[#e39b2e]">Sitter</span></span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-black">Warm, reliable pet sitting for dogs and cats. Walks, feeding, and peace of mind while you are away.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#c77e10]">Explore</h2>
          <ul className="space-y-2 text-sm text-[#5a4018]">
            <li><Link href="/booking" className="hover:text-[#e39b2e]">Booking</Link></li>
            <li><Link href="/shop" className="hover:text-[#e39b2e]">Shop</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#c77e10]">Contact</h2>
          <p className="text-sm text-black">Cambridge &amp; area, Ontario</p>
          <p className="mt-1 text-sm text-black"><span className="text-black">Email:</span>{" "}<a href="mailto:hello@pawsitter.example" className="font-medium text-black hover:underline">hello@pawsitter.example</a></p>
        </div>
      </div>
      <div className="border-t border-[#efd09a] py-4 text-center text-xs text-black">© {year} PawSitter. All rights reserved.</div>
    </footer>
  );
}
