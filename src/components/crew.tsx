"use client";

import type { GameState, UvIndex } from "@/contracts";
import { RULES } from "@/game/rules";

/** The four crew. Original characters, drawn from simple shapes so CSS can animate their moods. */
export const CREW = [
  { name: "Kiri", role: "Commander", suit: "#FF7A3D", skin: "#8D5A3B", hair: "#1B1F3B", extra: "bun" },
  { name: "Bo", role: "Engineer", suit: "#4CC9F0", skin: "#F2C29B", hair: "#C0582C", extra: "goggles" },
  { name: "Tamsin", role: "Botanist", suit: "#8BD450", skin: "#C98B5E", hair: "#3B2416", extra: "leaf" },
  { name: "Ozzie", role: "Doctor", suit: "#FFD23F", skin: "#E8B48A", hair: "#5B3A8C", extra: "antenna" },
] as const;

export type Mood = "happy" | "cold" | "tired" | "hungry" | "cheering" | "huddled";

export function moodOf(state: GameState): Mood {
  const last = state.outcomes[state.outcomes.length - 1];
  if (!last) return "happy";
  if (last.bet.huddle && state.phase === "night") return "huddled";
  if (last.mealsHarvested > 0 && state.phase === "night") return "cheering";
  if (last.hoursCold > 0) return "cold";
  if (state.outpost.airPercent < 40) return "tired";
  if (state.outpost.meals < 8) return "hungry";
  return "happy";
}

export const MOOD_LABEL: Record<Mood, { icon: string; word: string }> = {
  happy: { icon: "😊", word: "Happy" },
  cold: { icon: "🥶", word: "Cold" },
  tired: { icon: "😮‍💨", word: "Tired, the air is thin" },
  hungry: { icon: "🍽️", word: "Hungry" },
  cheering: { icon: "🎉", word: "Harvest party!" },
  huddled: { icon: "🛏️", word: "Huddled together" },
};

function Mouth({ mood }: { mood: Mood }) {
  if (mood === "cold") return <path d="M20 36 q2 -2 4 0 q2 2 4 0 q2 -2 4 0" stroke="#1B1F3B" strokeWidth="2" fill="none" />;
  if (mood === "tired" || mood === "hungry")
    return <path d="M21 37 q5 -3 10 0" stroke="#1B1F3B" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (mood === "cheering") return <path d="M19 33 q7 9 14 0 z" fill="#1B1F3B" />;
  return <path d="M20 34 q6 6 12 0" stroke="#1B1F3B" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
}

export function CrewMember({ index, mood, size = 64 }: { index: number; mood: Mood; size?: number }) {
  const c = CREW[index];
  const tint = mood === "cold" ? "#9FD8F5" : c.skin;
  const armsUp = mood === "cheering";
  const moodClass =
    mood === "happy"
      ? "mood-happy"
      : mood === "cold"
        ? "mood-cold"
        : mood === "tired"
          ? "mood-tired"
          : mood === "hungry"
            ? "mood-hungry"
            : mood === "cheering"
              ? "mood-cheer"
              : "";
  return (
    <svg
      viewBox="0 0 52 80"
      width={size}
      height={(size * 80) / 52}
      role="img"
      aria-label={`${c.name}, ${c.role}: ${MOOD_LABEL[mood].word}`}
      className="overflow-visible"
    >
      <g className={moodClass} style={{ animationDelay: `${index * 0.17}s` }}>
        {/* arms */}
        {armsUp ? (
          <>
            <rect x="0" y="30" width="9" height="22" rx="4.5" fill={c.suit} stroke="#1B1F3B" strokeWidth="2.5" transform="rotate(-25 4 50)" />
            <rect x="43" y="30" width="9" height="22" rx="4.5" fill={c.suit} stroke="#1B1F3B" strokeWidth="2.5" transform="rotate(25 48 50)" />
          </>
        ) : (
          <>
            <rect x="2" y="48" width="9" height="20" rx="4.5" fill={c.suit} stroke="#1B1F3B" strokeWidth="2.5" />
            <rect x="41" y="48" width="9" height="20" rx="4.5" fill={c.suit} stroke="#1B1F3B" strokeWidth="2.5" />
          </>
        )}
        {/* body */}
        <rect x="8" y="44" width="36" height="34" rx="12" fill={c.suit} stroke="#1B1F3B" strokeWidth="3" />
        <rect x="18" y="52" width="16" height="10" rx="3" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="2" />
        <circle cx="22" cy="57" r="2" fill="#EF476F" />
        <circle cx="30" cy="57" r="2" fill="#3DDC97" />
        {/* head */}
        <circle cx="26" cy="26" r="19" fill={tint} stroke="#1B1F3B" strokeWidth="3" />
        <path d="M9 22 q4 -16 17 -16 q13 0 17 16 q-8 -7 -17 -7 q-9 0 -17 7z" fill={c.hair} stroke="#1B1F3B" strokeWidth="2" />
        {c.extra === "bun" ? <circle cx="26" cy="5" r="6" fill={c.hair} stroke="#1B1F3B" strokeWidth="2.5" /> : null}
        {c.extra === "antenna" ? (
          <>
            <line x1="26" y1="7" x2="26" y2="-3" stroke="#1B1F3B" strokeWidth="2.5" />
            <circle cx="26" cy="-4" r="3.5" fill="#EF476F" stroke="#1B1F3B" strokeWidth="2" />
          </>
        ) : null}
        {c.extra === "leaf" ? <path d="M36 8 q10 -6 12 4 q-8 4 -12 -4z" fill="#8BD450" stroke="#1B1F3B" strokeWidth="2" /> : null}
        {/* eyes */}
        <g className={mood === "tired" ? "eyes-slow" : "eyes-blink"}>
          {c.extra === "goggles" ? (
            <>
              <circle cx="19" cy="26" r="6" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="2.5" />
              <circle cx="33" cy="26" r="6" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="2.5" />
            </>
          ) : null}
          <circle cx="19" cy="26" r={mood === "tired" ? 1.6 : 2.6} fill="#1B1F3B" />
          <circle cx="33" cy="26" r={mood === "tired" ? 1.6 : 2.6} fill="#1B1F3B" />
        </g>
        {mood === "tired" ? (
          <>
            <line x1="15" y1="23" x2="23" y2="24" stroke="#1B1F3B" strokeWidth="2" />
            <line x1="29" y1="24" x2="37" y2="23" stroke="#1B1F3B" strokeWidth="2" />
          </>
        ) : null}
        <circle cx="13" cy="32" r="3" fill="#EF476F" opacity="0.35" />
        <circle cx="39" cy="32" r="3" fill="#EF476F" opacity="0.35" />
        <Mouth mood={mood} />
      </g>
      {mood === "cold" ? (
        <g>
          <circle className="breath" cx="40" cy="36" r="4" fill="#FFFFFF" opacity="0.8" style={{ animationDelay: `${index * 0.3}s` }} />
        </g>
      ) : null}
      {mood === "hungry" && index % 2 === 0 ? (
        <g>
          <circle cx="44" cy="2" r="2" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="1.5" />
          <ellipse cx="52" cy="-10" rx="11" ry="9" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="2" />
          <circle cx="52" cy="-10" r="5" fill="#FFFFFF" stroke="#1B1F3B" strokeWidth="1.5" />
        </g>
      ) : null}
    </svg>
  );
}

function Confetti() {
  const colours = ["#FF7A3D", "#FFD23F", "#3DDC97", "#4CC9F0", "#EF476F", "#8BD450"];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="confetti-bit absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colours[i % colours.length],
            animationDelay: `${(i % 6) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

const SKY: Record<UvIndex, { top: string; bottom: string; sun: number; haze: number }> = {
  Very_High: { top: "#FFB98A", bottom: "#FFE3C4", sun: 1, haze: 0 },
  High: { top: "#F79A62", bottom: "#FFC992", sun: 0.85, haze: 0.05 },
  Moderate: { top: "#C9727A", bottom: "#E8A99A", sun: 0.6, haze: 0.25 },
  Low: { top: "#6B4A36", bottom: "#9C7354", sun: 0.25, haze: 0.75 },
};

/** The sky above the outpost shows today's measured sunlight. */
export function Sky({ sunlight, children }: { sunlight: UvIndex; children?: React.ReactNode }) {
  const sky = SKY[sunlight];
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(${sky.top}, ${sky.bottom})`, transition: "background 1s ease" }}
    >
      <div
        className="absolute right-[12%] top-4 rounded-full border-[3px] border-ink"
        style={{
          width: 56,
          height: 56,
          background: "#FFF2B3",
          opacity: sky.sun,
          boxShadow: `0 0 ${40 * sky.sun}px ${12 * sky.sun}px #FFE58A`,
          transition: "opacity 1s ease",
        }}
        aria-hidden
      />
      {sky.haze > 0 ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ opacity: sky.haze }}>
          <div
            className="dust-layer absolute -inset-x-1/4 inset-y-0"
            style={{
              background:
                "radial-gradient(60% 40% at 30% 40%, #8a6040cc, transparent), radial-gradient(50% 35% at 70% 60%, #7a5235cc, transparent), radial-gradient(40% 30% at 50% 20%, #a07650aa, transparent)",
            }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Cutaway of the habitat with the crew inside. */
export function Habitat({ state }: { state: GameState }) {
  const mood = moodOf(state);
  const lost = state.ending === "crewLost";
  const greenhouseOn = state.phase === "bet" ? !state.bet.huddle && state.bet.greenhouseWh > 0 : true;
  const cropShare = Math.min(1, state.outpost.cropLightWh / Math.max(1, state.outpost.cropNeedsWh));
  const plants = Math.max(1, Math.round(cropShare * 5));
  const label = MOOD_LABEL[mood];

  return (
    <div className="relative px-3 pb-0 pt-[120px] sm:px-6 sm:pt-24">
      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-[#C4572D]" aria-hidden />
      <div className="relative mx-auto grid max-w-3xl grid-cols-[1fr_2fr_0.9fr] overflow-hidden rounded-t-[48px] border-[3px] border-b-0 border-ink bg-[#E9E2D0]">
        {/* greenhouse */}
        <div className="relative flex flex-col items-center justify-end border-r-[3px] border-ink p-2" style={{ background: greenhouseOn ? "#EAFBD8" : "#B8B6A8" }}>
          <span className="absolute left-2 top-2 rounded-full bg-cream px-2 text-xs font-bold text-ink">Greenhouse</span>
          {greenhouseOn ? <div className="absolute inset-x-2 top-8 h-2 rounded-full bg-sun shadow-[0_0_18px_6px_#FFE58A]" aria-hidden /> : null}
          <div className="flex items-end gap-1 pb-1" aria-label={`Crop ${Math.round(cropShare * 100)} percent grown`}>
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} viewBox="0 0 20 30" width="16" height="24" aria-hidden>
                <rect x="3" y="22" width="14" height="8" rx="2" fill="#A0522D" stroke="#1B1F3B" strokeWidth="1.5" />
                {i < plants ? (
                  <>
                    <line x1="10" y1="22" x2="10" y2={22 - 6 - cropShare * 10} stroke="#3E7D23" strokeWidth="2" />
                    <ellipse cx="7" cy={18 - cropShare * 8} rx="4" ry="2.5" fill="#8BD450" stroke="#1B1F3B" strokeWidth="1" />
                    <ellipse cx="13" cy={16 - cropShare * 8} rx="4" ry="2.5" fill="#8BD450" stroke="#1B1F3B" strokeWidth="1" />
                  </>
                ) : null}
              </svg>
            ))}
          </div>
        </div>

        {/* living quarters */}
        <div className="relative flex min-h-[150px] flex-col items-center justify-end border-r-[3px] border-ink bg-[#F7EBD3] px-1 pb-1 sm:min-h-[170px]">
          <span className="absolute left-2 top-2 hidden rounded-full bg-cream px-2 text-xs font-bold text-ink sm:inline">Crew room</span>
          {!lost ? (
            <span className="absolute right-2 top-2 rounded-full border-2 border-ink bg-white px-2 text-xs font-bold text-ink sm:text-sm">
              <span aria-hidden>{label.icon}</span> {label.word}
            </span>
          ) : null}
          {lost ? (
            <p className="mb-6 px-2 text-center text-base font-bold text-ink">
              🚀 The crew was flown home safely by a rescue rocket.
            </p>
          ) : mood === "huddled" ? (
            <div className="relative flex items-end justify-center">
              <div className="flex -space-x-3">
                {CREW.map((_, i) => (
                  <CrewMember key={i} index={i} mood="happy" size={42} />
                ))}
              </div>
              <div
                className="absolute inset-x-[-10px] bottom-0 h-[52%] rounded-t-[28px] border-[3px] border-ink"
                style={{ background: "repeating-linear-gradient(45deg,#EF476F 0 10px,#F47C98 10px 20px)" }}
                aria-hidden
              />
            </div>
          ) : (
            <div className="flex items-end justify-center gap-0.5 sm:gap-3">
              {CREW.map((_, i) => (
                <CrewMember key={i} index={i} mood={mood} size={44} />
              ))}
            </div>
          )}
          {mood === "cheering" ? <Confetti /> : null}
        </div>

        {/* power room */}
        <div className="relative flex flex-col items-center justify-end bg-[#DCE9F2] p-2">
          <span className="absolute left-2 top-2 rounded-full bg-cream px-2 text-xs font-bold text-ink">Power</span>
          <svg viewBox="0 0 30 44" width="30" height="44" aria-hidden>
            <rect x="9" y="1" width="12" height="5" rx="1.5" fill="#1B1F3B" />
            <rect x="2" y="5" width="26" height="38" rx="6" fill="#FFF6E5" stroke="#1B1F3B" strokeWidth="3" />
            {[0, 1, 2, 3].map((bar) => (
              <rect
                key={bar}
                x="6"
                y={33 - bar * 8}
                width="18"
                height="6"
                rx="2"
                fill={state.outpost.batteryWh / RULES.BATTERY_CAPACITY_WH > bar / 4 + 0.01 ? "#4CC9F0" : "#d9d9d9"}
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
