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
            <span className="text-[#c45c26]">Calm owners.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#7a5c4e] sm:text-lg">
            PawSitter offers Nutrition and Longevity Advises — with Researched Products and Sitter Services that best fit your paw kids, in the most affordable ways.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/booking"
              className="inline-flex items-center justify-center rounded-full bg-[#c45c26] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#9a4519]"
            >
              Request a booking
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-full border border-[#e8d5c4] bg-[#fff8f0] px-6 py-3 text-sm font-semibold text-[#5c4033] transition hover:border-[#c45c26] hover:text-[#c45c26]"
            >
              View services
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
              <h2 className="mt-4 text-2xl font-bold text-[#3b2a22]">Paw Sitter</h2>
              <p className="mt-2 text-sm text-[#7a5c4e]">
                Placeholder logo — warm, friendly care for every paw.
              </p>
              <ul className="mt-6 w-full space-y-2 text-left text-sm text-[#5c4033]">
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Dog walking</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Cat &amp; dog feeding</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">House sitting</li>
                <li className="rounded-xl bg-[#faf3eb] px-4 py-2">Photo check-ins</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Reliable visits",
            text: "On-time walks and feeding with a calm, pet-first approach.",
          },
          {
            title: "Updates for you",
            text: "Photos and notes so you feel close to home while away.",
          },
          {
            title: "Simple booking",
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
