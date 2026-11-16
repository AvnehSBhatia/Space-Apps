import type { Metadata } from "next";
import Link from "next/link";
import { DataCredits } from "@/components/data-credits";
import { RuleCardView } from "@/components/rule-cards";
import { game } from "@/game";

export const metadata: Metadata = { title: "How it works · SolCast" };

export default function HowItWorks() {
  const cards = game.rules();
  return (
    <>
      <nav className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 pt-4">
        <Link href="/" className="font-display text-2xl font-extrabold text-sun">
          ☀️ SolCast
        </Link>
        <Link href="/mission" className="btn btn-primary min-h-12 px-4 text-base">
          ▶ Play
        </Link>
      </nav>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-extrabold">How it works</h1>
          <p className="text-cream/90">
            Some numbers are real measurements from NASA&apos;s Curiosity rover. Some are physics. The rest are game rules we
            chose. Every card says which.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.id} id={card.id} className="chunk bg-cream p-5">
              <RuleCardView card={card} />
            </article>
          ))}
        </div>
      </main>
      <DataCredits />
    </>
  );
}
