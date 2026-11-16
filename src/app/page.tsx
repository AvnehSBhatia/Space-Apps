import Link from "next/link";
import { DataCredits } from "@/components/data-credits";
import { HomeHero } from "@/components/home-hero";

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
        <HomeHero />
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["☀️", "Read the sky", "Real sunlight from the Curiosity rover sets your power."],
            ["🌱", "Make a plan", "Grow air and food, or save energy for the night."],
            ["🌙", "Face the night", "The rover's real temperature decides what happens."],
          ].map(([icon, title, text]) => (
            <div key={title} className="chunk flex flex-col gap-1 bg-indigo p-4">
              <p className="text-3xl" aria-hidden>
                {icon}
              </p>
              <h2 className="font-display text-xl font-extrabold text-sun">{title}</h2>
              <p className="text-base text-cream/90">{text}</p>
            </div>
          ))}
        </section>
        <p className="text-center text-base text-cream/80">
          Curious how the numbers work?{" "}
          <Link href="/how-it-works" className="font-bold text-sun underline underline-offset-4">
            See every rule
          </Link>
          .
        </p>
      </main>
      <DataCredits />
    </>
  );
}
