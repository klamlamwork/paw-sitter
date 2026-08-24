import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-block rounded-full bg-[#f3e0d0] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#c45c26]">
            Local pet care you can trust
          </p>
          <h1 className="text-3xl font-bold leading-tight text-[#3b2a22] sm:text-4xl lg:text-5xl">
            Happy, Healthy PAWS.{" "}
            <span className="text-[#b5710b]">Joyful PARENTS.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#70706f] sm:text-lg">
            Joyful PAWS offers Nutrition and Longevity Advises — with Researched Products and Sitter Services that best fit your paw kids, in the most affordable ways.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/booking"
              className="inline-flex items-center justify-center rounded-full bg-[#b5710b] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#9a4519]"
            >
              Book Service
            </Link>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full border border-[#e8d5c4] bg-[#fff8f0] px-6 py-3 text-sm font-semibold text-[#b5710b] transition hover:border-[#c45c26] hover:text-[#c45c26]"
            >
              Shop, Get Rewards!
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-[#e8d5c4] bg-[#fff8f0]/90 p-8 shadow-lg shadow-[#c45c26]/10">
            <div className="flex flex-col items-center text-center">
              <Image
                src="/logo.svg"
                alt="Paw Sitter"
                width={120}
                height={120}
                className="h-28 w-28"
                priority
              />
              <h2 className="mt-4 text-2xl font-bold text-[#3b2a22]">Get Cash Back Rewards taking best care of your PAW kids!</h2>
              <p className="mt-2 text-sm text-[#7a5c4e]">
                Get the longevity products and services best fit your kids.
              </p>
              <ul className="mt-6 w-full space-y-2 text-left text-sm text-[#5c4033]">
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Strictly Reviewed Products</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Services by Professionally Trained Partners</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Tailored Nutrition Advise</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Drop-in Physical Check-ups</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Get Services/Products",
            text: "On-time walks and feeding with a calm, pet-first approach.",
          },
          {
            title: "Write Reviews",
            text: "Photos and notes so you feel close to home while away.",
          },
          {
            title: "Get Rewarded",
            text: "Request dates online — no payment gateway needed for v1.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-[#e8d5c4] bg-[#fff8f0]/85 p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-[#3b2a22]">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#7a5c4e]">{card.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
