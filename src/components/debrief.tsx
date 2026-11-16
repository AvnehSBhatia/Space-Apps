"use client";

import { useState } from "react";
import type { GameState } from "@/contracts";
import { game } from "@/game";
import { CREW, CrewMember } from "./crew";
import { missionCode } from "./format";

export function DebriefScreen({ state, onPlayAgain, onMenu }: { state: GameState; onPlayAgain: () => void; onMenu: () => void }) {
  const debrief = game.debrief(state);
  const code = missionCode(state);
  const [copied, setCopied] = useState(false);
  const survived = state.ending !== "crewLost";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="chunk pop-in flex flex-col gap-5 bg-cream p-5 text-ink sm:p-8" aria-labelledby="debrief-title">
      <p className="font-display text-lg font-extrabold uppercase tracking-wide text-orange">Mission debrief</p>
      <h1 id="debrief-title" className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
        {survived ? "🎉 " : "🚀 "}
        {debrief.headline}
      </h1>
      <div className="flex justify-center gap-2" aria-hidden>
        {CREW.map((_, i) => (
          <CrewMember key={i} index={i} mood={survived ? "cheering" : "tired"} size={56} />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-lg">
        {debrief.lines.map((line) => (
          <li key={line} className="rounded-2xl bg-white/80 px-3 py-2">
            {line}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border-[3px] border-ink bg-sun p-3 text-center">
          <p className="font-bold">Your score</p>
          <p className="tnum font-display text-4xl font-extrabold">{state.score.total}</p>
        </div>
        <div className="rounded-3xl border-[3px] border-ink bg-white p-3 text-center">
          <p className="font-bold">Careful commander</p>
          <p className="tnum font-display text-4xl font-extrabold">{debrief.carefulCommander.total}</p>
        </div>
      </div>
      <p className="text-base text-ink/80">
        The careful commander follows one simple rule and cannot see the future.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-[3px] border-dashed border-ink p-3">
        <span>Mission code:</span>
        <code className="tnum rounded-lg bg-indigo px-2 py-1 font-bold text-cream">{code}</code>
        <button className="btn btn-cream min-h-12 px-4 text-base" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
        <span className="w-full text-sm text-ink/70">Share it so a friend can play the very same sols.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn btn-primary w-full" onClick={onPlayAgain} autoFocus>
          Play again
        </button>
        <button className="btn btn-cream w-full" onClick={onMenu}>
          Pick another mission
        </button>
      </div>
    </section>
  );
}
