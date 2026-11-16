"use client";

import { useState } from "react";
import type { GameState } from "@/contracts";
import { game } from "@/game";
import { missionCode } from "./format";
import { Icon, type IconName } from "./icons";
import { MarsScene } from "./mars-scene";

function iconFor(line: string): { name: IconName; tone: string } {
  const l = line.toLowerCase();
  if (l.includes("cold") || l.includes("night")) return { name: "thermo", tone: "text-rust" };
  if (l.includes("harvest") || l.includes("meal") || l.includes("crop")) return { name: "sprout", tone: "text-food" };
  if (l.includes("storm") || l.includes("dust") || l.includes("rover")) return { name: "air", tone: "text-danger" };
  if (l.includes("battery") || l.includes("power")) return { name: "bolt", tone: "text-battery" };
  return { name: "star", tone: "text-sun" };
}

export function DebriefScreen({ state, onPlayAgain, onMenu }: { state: GameState; onPlayAgain: () => void; onMenu: () => void }) {
  const debrief = game.debrief(state);
  const code = missionCode(state);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative -mx-4 flex min-h-[calc(100vh-4rem)] items-start justify-center overflow-hidden px-4 pb-16 pt-8 sm:-mx-6 sm:px-6 sm:pt-12">
      <MarsScene weather={state.ending === "crewLost" ? "Low" : "night"} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-haze via-haze/60 to-transparent" aria-hidden />
      <section className="card reveal relative w-full max-w-3xl p-6 sm:p-10" aria-labelledby="debrief-title">
        <p className="text-ink-2">Mission debrief: {state.mission.title}</p>
        <h1 id="debrief-title" className="mt-2 text-4xl sm:text-5xl">
          {debrief.headline}
        </h1>
        <ul className="mt-6 divide-y divide-line">
          {debrief.lines.map((line) => {
            const icon = iconFor(line);
            return (
              <li key={line} className="flex items-start gap-4 py-3 text-lg">
                <Icon name={icon.name} size={26} className={`mt-0.5 flex-none ${icon.tone}`} />
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 grid gap-3 min-[460px]:grid-cols-2">
          <div className="rounded-xl border border-dusk/40 bg-dusk-soft px-5 py-4">
            <p className="label">Your score</p>
            <p className="readout text-5xl">{state.score.total}</p>
          </div>
          <div className="rounded-xl border border-line px-5 py-4">
            <p className="label">Careful commander</p>
            <p className="readout text-5xl">{debrief.carefulCommander.total}</p>
          </div>
        </div>
        <p className="mt-2 text-[0.95rem] text-ink-2">The careful commander follows one simple rule and can&apos;t see the future.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
          <span className="text-ink-2">Mission code</span>
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />
          <code className="readout text-[1rem]">{code}</code>
          <button className="btn btn-quiet ml-auto min-h-11 px-4 text-[0.95rem]" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} size={18} /> {copied ? "Copied" : "Copy"}
          </button>
          <p className="w-full text-sm text-ink-2">Share it and a friend plays the very same sols.</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="btn btn-primary w-full text-lg" onClick={onPlayAgain} autoFocus>
            Play again
          </button>
          <button className="btn btn-quiet w-full text-lg" onClick={onMenu}>
            Choose another mission
          </button>
        </div>
      </section>
    </div>
  );
}
