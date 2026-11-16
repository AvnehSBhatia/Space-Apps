import type { Metadata } from "next";
import Link from "next/link";
import { DataCredits } from "@/components/data-credits";
import { RulesGrid } from "@/components/rules-grid";
import { NavLink, SiteNav } from "@/components/site-nav";

export const metadata: Metadata = { title: "How it works - SolCast" };

export default function HowItWorks() {
  return (
    <>
      <SiteNav
        right={
          <>
            <NavLink href="/mission">Missions</NavLink>
            <NavLink href="/how-it-works" active>
              How it works
            </NavLink>
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold sm:text-5xl">How it works</h1>
          <p className="max-w-2xl text-xl text-ink-2">Every number is real NASA data, physics, or a rule we chose. Each card says which.</p>
        </header>
        <RulesGrid />
        <div>
          <Link href="/mission" className="btn btn-primary text-lg">
            Start a mission
          </Link>
        </div>
      </main>
      <DataCredits />
    </>
  );
}
