import Link from "next/link";
import { isExternalHttpUrl, retailerOfferHref } from "@/lib/shop";

export default function EligibleRetailers({ retailers = [] }) {
  if (!retailers.length) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-[#3b2a22]">Eligible retailers</h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {retailers.map((o) => {
          const s = o.shop;
          if (!s) return null;
          const href = retailerOfferHref(s, o.product_page_url);
          const external = isExternalHttpUrl(href);
          const inner = (
            <>
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.logo_url}
                  alt={s.name}
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-[#e8d5c4]"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff8f0] text-sm font-bold text-[#c45c26] ring-1 ring-[#e8d5c4]">
                  {s.name.slice(0, 1)}
                </span>
              )}
              <span className="max-w-[4.5rem] truncate text-center text-[10px] font-semibold text-[#3b2a22]">
                {s.name}
              </span>
            </>
          );
          return (
            <li key={o.id || o.shop_id}>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5"
                  title={href}
                >
                  {inner}
                </a>
              ) : (
                <Link href={href} className="flex flex-col items-center gap-1.5" title={href}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
