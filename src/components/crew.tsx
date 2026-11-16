"use client";

import Image from "next/image";
import type { GameState, UvIndex } from "@/contracts";
import { SUNLIGHT_WORD, niceDate } from "./format";
import { Icon, type IconName } from "./icons";
import { Num } from "./rule-cards";

/** The crew is shown as four suit colours, never as drawn people. */
const SUITS = ["#E8743B", "#3D5BD9", "#5FA83A", "#E9B22F"];

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
    <div className="inline-flex items-center gap-3 rounded-full bg-white/95 px-3 py-1.5 text-[0.95rem] font-semibold text-ink shadow-sm">
      <span className="flex -space-x-1.5" aria-hidden>
        {SUITS.map((colour, i) => (
          <svg key={colour} viewBox="0 0 20 20" width="22" height="22">
            <circle cx="10" cy="10" r="9" fill={colour} stroke="#fff" strokeWidth="2" />
            <rect x="5" y="6.5" width="10" height="6" rx="3" fill={mood === "cold" ? "#BFE6FA" : "#1B2148"} opacity={0.85} />
            <circle cx={7.5 + (i % 2)} cy="8.4" r="1" fill="#fff" opacity="0.8" />
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

function sceneFor(state: GameState): { src: string; alt: string } {
  if (state.phase === "night") return { src: "/art/scene-night.webp", alt: "The outpost at night under the stars" };
  const byLight: Record<UvIndex, { src: string; alt: string }> = {
    Very_High: { src: "/art/scene-day.webp", alt: "The outpost on a clear, bright day" },
    High: { src: "/art/scene-day.webp", alt: "The outpost on a clear, bright day" },
    Moderate: { src: "/art/scene-haze.webp", alt: "The outpost on a hazy, dusty day" },
    Low: { src: "/art/scene-storm.webp", alt: "The outpost inside a thick dust storm" },
  };
  return byLight[state.sunlight];
}

function Confetti() {
  const colours = ["#F2A541", "#3D5BD9", "#1FB58F", "#E04867", "#6CB33F"];
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

/** The outpost banner. The picture follows the real sunlight; chips carry the data. */
export function OutpostScene({ state }: { state: GameState }) {
  const scene = sceneFor(state);
  const mood = moodOf(state);
  const lost = state.ending === "crewLost";
  const night = state.phase === "night";

  return (
    <div className="relative h-56 overflow-hidden rounded-[22px] border border-line bg-ink sm:h-64 lg:h-72">
      <Image
        src={scene.src}
        alt={scene.alt}
        fill
        priority
        sizes="(max-width: 1200px) 100vw, 1152px"
        className="object-cover object-[50%_62%]"
      />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/25 to-transparent" aria-hidden />
      <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 text-[0.95rem] font-semibold text-ink shadow-sm sm:left-4 sm:top-4">
        <Icon name="book" size={17} className="text-ink-2" />
        Earth date {niceDate(state.todayEarthDate)}
      </span>
      {!night ? (
        <span className="absolute right-3 top-14 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 text-[0.95rem] font-semibold text-ink shadow-sm sm:right-4 sm:top-4">
          <Icon name="sun" size={18} className="text-sun" />
          Sunlight: <Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num>
        </span>
      ) : null}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
        {lost ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 font-semibold text-ink">
            <Icon name="rocket" size={18} className="text-dusk" /> The crew was flown home safely.
          </span>
        ) : (
          <CrewStatus mood={mood} />
        )}
      </div>
      <span className="absolute bottom-2 right-3 rounded bg-black/40 px-1.5 text-[0.7rem] font-medium text-white">
        AI-generated art
      </span>
      {mood === "harvest" ? <Confetti /> : null}
    </div>
  );
}
