"use client";

import type { GameState } from "@/contracts";
import { SUNLIGHT_WORD, niceDate } from "./format";
import { Icon, type IconName } from "./icons";
import { MarsScene } from "./mars-scene";
import { Num } from "./rule-cards";

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
    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-haze/85 px-3 py-1.5 text-[0.95rem] font-medium text-ink backdrop-blur">
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

function Confetti() {
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

const CHIP = "inline-flex items-center gap-2 rounded-full border border-white/10 bg-haze/85 px-3 py-1.5 text-[0.95rem] font-medium text-ink backdrop-blur";

/** The outpost banner: Gale Crater drawn in SVG. The sky follows the real sunlight; chips carry the data. */
export function OutpostScene({ state }: { state: GameState }) {
  const mood = moodOf(state);
  const lost = state.ending === "crewLost";
  const night = state.phase === "night";
  const weather = night ? "night" : state.sunlight;

  return (
    <div className="relative h-56 overflow-hidden rounded-[16px] border border-line bg-deep sm:h-64 lg:h-[19rem]">
      <MarsScene
        weather={weather}
        className="absolute inset-0 h-full w-full"
        title={night ? "The outpost at night in Gale Crater" : `The outpost in Gale Crater, sunlight ${SUNLIGHT_WORD[state.sunlight]}`}
      />
      <span className={`${CHIP} absolute left-3 top-3 sm:left-4 sm:top-4`}>
        <Icon name="book" size={16} className="text-ink-2" />
        {niceDate(state.todayEarthDate)}
      </span>
      {!night ? (
        <span className={`${CHIP} absolute right-3 top-14 sm:right-4 sm:top-4`}>
          <Icon name="sun" size={17} className="text-sun" />
          Sunlight <Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num>
        </span>
      ) : null}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
        {lost ? (
          <span className={CHIP}>
            <Icon name="rocket" size={17} className="text-dusk" /> The crew was flown home safely.
          </span>
        ) : (
          <CrewStatus mood={mood} />
        )}
      </div>
      {mood === "harvest" ? <Confetti /> : null}
    </div>
  );
}
