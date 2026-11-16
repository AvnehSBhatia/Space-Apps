"use client";

import type { GameState } from "@/contracts";
import { Icon, type IconName } from "./icons";

/** The crew is shown as four suit colours, never as drawn people. */
const SUITS = ["#ff4a1f", "#7cb8ec", "#b9d36a", "#f2b24a"];

export type Mood = "well" | "cold" | "tired" | "hungry" | "harvest" | "huddled";

export function moodOf(state: GameState): Mood {
  const last = state.outcomes[state.outcomes.length - 1];
  if (!last) return "well";
  if (last.bet.huddle && state.phase === "night") return "huddled";
  if (last.mealsHarvested > 0 && state.phase === "night") return "harvest";
  if (last.hoursCold > 0) return "cold";
  if (state.outpost.airPercent < 40) return "tired";
  if (state.outpost.meals < 8) return "hungry";
  return "well";
}

export const MOOD: Record<Mood, { icon: IconName; word: string; tone: string }> = {
  well: { icon: "heart", word: "Warm and well", tone: "text-air" },
  cold: { icon: "thermo", word: "Cold last night", tone: "text-battery" },
  tired: { icon: "air", word: "Tired, the air is thin", tone: "text-danger" },
  hungry: { icon: "food", word: "Hungry", tone: "text-sun" },
  harvest: { icon: "sprout", word: "Harvest day", tone: "text-food" },
  huddled: { icon: "huddle", word: "Huddled in one room", tone: "text-dusk" },
};

/** Four helmets, one per crew member, plus the crew's mood in words. */
export function CrewStatus({ mood }: { mood: Mood }) {
  const m = MOOD[mood];
  return (
    <div className="hud inline-flex items-center gap-3 px-3.5 py-2 text-[0.95rem] text-ink">
      <span className="flex -space-x-1.5" aria-hidden>
        {SUITS.map((colour, i) => (
          <svg key={colour} viewBox="0 0 20 20" width="22" height="22">
            <circle cx="10" cy="10" r="9" fill={colour} stroke="#18191b" strokeWidth="2" />
            <rect x="5" y="6.5" width="10" height="6" rx="3" fill={mood === "cold" ? "#cfe7f7" : "#18191b"} />
            <circle cx={7.5 + (i % 2)} cy="8.4" r="1" fill="#eff0f1" opacity="0.7" />
          </svg>
        ))}
      </span>
      <span className="flex items-center gap-1.5">
        <Icon name={m.icon} size={18} className={m.tone} />
        <span>Crew: {m.word}</span>
      </span>
    </div>
  );
}

export function Confetti() {
  const colours = ["#ff4a1f", "#f2b24a", "#6fd3a6", "#7cb8ec", "#b9d36a"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className="confetti-bit absolute top-0 block h-2.5 w-1.5 rounded-sm"
          style={{ left: `${(i * 41) % 100}%`, background: colours[i % colours.length], animationDelay: `${(i % 6) * 0.1}s` }}
        />
      ))}
    </div>
  );
}
