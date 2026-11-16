"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CREW, CrewMember } from "./crew";
import { SAVE_KEY } from "./format";

function hasSave(): boolean {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.phase !== "ended";
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function HomeHero() {
  const canContinue = useSyncExternalStore(subscribe, hasSave, () => false);

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden>
        <circle cx="60" cy="60" r="34" fill="#FF7A3D" stroke="#1B1F3B" strokeWidth="5" />
        <circle cx="48" cy="52" r="7" fill="#E0602A" />
        <circle cx="70" cy="70" r="5" fill="#E0602A" />
        <ellipse cx="60" cy="60" rx="56" ry="16" fill="none" stroke="#FFD23F" strokeWidth="6" transform="rotate(-18 60 60)" />
        <circle cx="104" cy="44" r="7" fill="#4CC9F0" stroke="#1B1F3B" strokeWidth="3" />
      </svg>
      <h1 className="font-display text-6xl font-extrabold leading-none text-sun sm:text-7xl">SolCast</h1>
      <p className="max-w-xl text-xl text-cream sm:text-2xl">
        Keep four astronauts safe on Mars, using the real weather the Curiosity rover measured.
      </p>
      <div className="flex items-end gap-1" aria-hidden>
        {CREW.map((_, i) => (
          <CrewMember key={i} index={i} mood="happy" size={58} />
        ))}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href="/mission" className="btn btn-primary w-full text-2xl">
          ▶ Play
        </Link>
        {canContinue ? (
          <Link href="/mission?continue=1" className="btn btn-sun w-full">
            Continue my mission
          </Link>
        ) : null}
        <Link href="/how-it-works" className="btn btn-cream w-full">
          How it works
        </Link>
      </div>
    </section>
  );
}
