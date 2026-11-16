"use client";

import { useEffect, useState, type Dispatch, type ReactNode } from "react";
import type { Action, GameState, WhatIf } from "@/contracts";
import { carefulBet, game } from "@/game";
import { SUNLIGHT_LEVEL_WORD, SUNLIGHT_WORD, kWh, niceDate } from "./format";
import { Icon, type IconName } from "./icons";
import { Num } from "./rule-cards";
import { Thermometer } from "./thermometer";

type Props = { state: GameState; dispatch: Dispatch<Action> };

function lastNightLow(state: GameState): number | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const low = state.history[i].minTempC;
    if (low != null) return low;
  }
  return null;
}

const STEPS = [
  { phase: "bet", label: "Plan" },
  { phase: "night", label: "Night" },
] as const;

/** The console docked under the stage. Its strip shows where the sol is up to. */
export function Console({ state, children }: { state: GameState; children: ReactNode }) {
  const current = state.phase === "night" ? 1 : 0;
  return (
    <div className="rounded-b-[16px] border border-line bg-card">
      <ol className="flex border-b border-line text-[0.92rem]" aria-label="Steps of this sol">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={step.phase}
              aria-current={active ? "step" : undefined}
              className={`relative flex items-center gap-2 px-3 py-3 sm:flex-1 sm:px-5 ${active ? "flex-1 text-ink" : "text-ink-2"}`}
            >
              <span
                className={`readout grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] ${
                  active ? "bg-dusk text-on-action" : done ? "bg-[#33363b] text-ink" : "border border-line"
                }`}
              >
                {done ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`truncate ${active ? "" : "hidden sm:inline"}`}>{step.label}</span>
              {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-dusk" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <div className="p-5 sm:p-7">{children}</div>
    </div>
  );
}

function Row({ label, children, tone }: { label: ReactNode; children: ReactNode; tone?: string }) {
  return (
    <div className="leader py-1.5">
      <span className="text-ink-2">{label}</span>
      <span className="readout text-[1rem]" style={tone ? { color: tone } : undefined}>
        {children}
      </span>
    </div>
  );
}

type Zone = "good" | "tight" | "cold";
const ZONE_COLOUR: Record<Zone, string> = { good: "var(--air)", tight: "var(--sun)", cold: "var(--danger)" };
const ZONE_TEXT: Record<Zone, string> = { good: "text-air", tight: "text-sun", cold: "text-danger" };
const ZONE_SOFT: Record<Zone, string> = { good: "bg-air-soft", tight: "bg-sun-soft", cold: "bg-danger-soft" };
const SAMPLES = 25;

const zoneOf = (result: WhatIf): Zone => (result.hoursCold > 0 ? "cold" : result.spareNights >= 1 ? "good" : "tight");
const hoursWord = (hours: number) => `${hours} ${hours === 1 ? "hour" : "hours"}`;

/** The coldest night the forecast shown to the player allows for. */
function coldestForecast(state: GameState): number {
  const last = lastNightLow(state);
  return state.earthForecast?.nightLow.low ?? state.outpostForecast?.nightLow.low ?? (last != null ? last - 3 : -80);
}

/** One sentence that says what the current plan means. Built only from the game's own what-if. */
function planSentence(state: GameState, preview: WhatIf, greenhouseWh: number): string {
  if (state.bet.huddle) {
    return preview.hoursCold > 0
      ? `Huddle. Even so, the heaters stop ${hoursWord(preview.hoursCold)} before sunrise.`
      : "Huddle. Night power drops a lot, but no air is made today.";
  }
  if (preview.hoursCold > 0) {
    return greenhouseWh > 0
      ? `Too much. The heaters stop ${hoursWord(preview.hoursCold)} before sunrise.`
      : `Not enough power. The heaters stop ${hoursWord(preview.hoursCold)} early. Try Huddle.`;
  }
  if (preview.spareNights < 1) return "Careful. Warm tonight, but nothing spare for tomorrow.";
  const now = state.outpost.airPercent;
  const air = preview.airAfter > now ? "air goes up" : preview.airAfter < now ? "air goes down" : "air holds";
  return `Good plan. Warm tonight, ${air}, ${preview.spareNights} spare ${preview.spareNights === 1 ? "night" : "nights"}.`;
}

function Tile({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: IconName;
  tone: string;
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-haze px-4 py-3">
      <p className="flex items-center gap-2 text-[0.9rem] text-ink-2">
        <Icon name={icon} size={17} className={tone} /> {label}
      </p>
      <p className="readout mt-1 text-[1.35rem] leading-tight text-ink">{value}</p>
      {note ? <p className="mt-1 text-[0.88rem] leading-snug text-ink-2">{note}</p> : null}
    </div>
  );
}

function Result({ label, value, tone }: { label: ReactNode; value: ReactNode; tone: string }) {
  return (
    <div className="flex-1 rounded-[10px] bg-haze px-2 py-2.5 text-center">
      <p className="text-[0.85rem] text-ink-2">{label}</p>
      <p className="readout mt-0.5 text-[1.15rem]" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

/** The whole day on one screen, read top to bottom: what you have, your one choice, what it means, go. */
export function BetPanel({ state, dispatch }: Props) {
  const coldest = coldestForecast(state);
  const max = state.maxGreenhouseWh;
  const huddle = state.bet.huddle;
  const value = huddle ? 0 : state.bet.greenhouseWh;
  const preview = game.whatIf(state, state.bet, coldest);
  const zone = zoneOf(preview);
  // Huddle is a trade, not a free win, so it never shows as plain green.
  const tone: Zone = huddle && zone === "good" ? "tight" : zone;
  const low = lastNightLow(state);
  const cropPct = Math.min(100, Math.round((preview.cropLightAfterWh / Math.max(1, state.outpost.cropNeedsWh)) * 100));
  const lock = () => dispatch({ type: "lockBet" });

  // Colour the track by what each position would mean tonight.
  const samples = Array.from({ length: SAMPLES }, (_, i) =>
    game.whatIf(state, { greenhouseWh: Math.round((max * i) / (SAMPLES - 1)), huddle }, coldest),
  );
  const track = `linear-gradient(to right, ${samples
    .map((sample, i) => {
      const from = Math.max(0, ((i - 0.5) / (SAMPLES - 1)) * 100);
      const to = Math.min(100, ((i + 0.5) / (SAMPLES - 1)) * 100);
      return `${ZONE_COLOUR[zoneOf(sample)]} ${from}% ${to}%`;
    })
    .join(", ")})`;
  const airIndex = huddle || max <= 0 ? -1 : samples.findIndex((sample) => sample.airAfter >= state.outpost.airPercent);

  const blackout = state.contact === "blackout";
  const nudge = state.mode === "guided" && state.solIndex < 3 && !blackout;
  const forecast = state.earthForecast ?? state.outpostForecast;
  const forecastFrom = state.earthForecast ? "Mission Control" : "Your outpost computer";
  const tomorrow = forecast ? SUNLIGHT_LEVEL_WORD[Math.round(forecast.sunlightTomorrow.value)] : null;
  const airNow = Math.round(state.outpost.airPercent);
  const airAfter = Math.round(preview.airAfter);
  const airArrow = airAfter > airNow ? " ↑" : airAfter < airNow ? " ↓" : "";
  const lastNight = low != null ? (
    <>
      {" "}
      Last night: <Num rule="nightLow">{low} C</Num>.
    </>
  ) : null;

  return (
    <section aria-labelledby="today-title" className="mx-auto flex max-w-[46rem] flex-col gap-5">
      {/* 1. What you have today. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          icon="sun"
          tone="text-sun"
          label="Sun today"
          value={<Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num>}
          note={
            <>
              Panels collect <Num rule="solar">{kWh(state.solarWh)}</Num>.{tomorrow ? ` Tomorrow: ${tomorrow}.` : ""}
            </>
          }
        />
        <Tile
          icon="battery"
          tone="text-battery"
          label="Battery now"
          value={kWh(state.outpost.batteryWh)}
          note={
            state.computerWh > 0
              ? `The outpost computer uses ${kWh(state.computerWh)} today.`
              : "It has to last the whole night."
          }
        />
        <Tile
          icon={forecast ? "thermo" : "noSignal"}
          tone="text-dusk"
          label="Tonight"
          value={forecast ? `about ${Math.round(forecast.nightLow.value)} C` : "No signal"}
          note={
            forecast ? (
              <>
                {forecastFrom} says {Math.round(forecast.nightLow.high)} to {Math.round(forecast.nightLow.low)} C.
                {state.earthForecast && state.outpostForecast
                  ? ` Your computer says ${Math.round(state.outpostForecast.nightLow.value)} C.`
                  : ""}
                {lastNight}
              </>
            ) : (
              <>
                The Sun is between Mars and Earth, so there is no forecast.
                {state.availableTools.length > 0 ? " The Brain Bay can make one." : ""}
                {lastNight}
              </>
            )
          }
        />
      </div>

      {/* 2. The one choice, and what it means. */}
      <div className="flex flex-col gap-4 rounded-[14px] border border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="today-title" className="text-[1.5rem] sm:text-[1.75rem]">
            How much power for the greenhouse?
          </h2>
          <p className="readout text-[1.1rem]">
            {kWh(value)} <span className="text-ink-2">of {kWh(max)}</span>
          </p>
        </div>
        {state.solIndex === 0 ? (
          <p className="-mt-2 text-[0.98rem] text-ink-2">
            A <Num rule="mars-day">sol</Num> is one day on Mars. Keep the crew safe for {state.mission.lengthSols} of them.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <input
            type="range"
            className="slider"
            min={0}
            max={max}
            step={500}
            value={value}
            disabled={huddle || max <= 0}
            style={{ background: huddle ? "#3a3d42" : track, height: 14 }}
            aria-label="Power for the greenhouse lights"
            aria-valuetext={`${kWh(value)} for the greenhouse. ${planSentence(state, preview, value)}`}
            onChange={(event) => dispatch({ type: "setBet", bet: { ...state.bet, greenhouseWh: Number(event.target.value) } })}
            onKeyDown={(event) => {
              if (event.key === "Enter") lock();
            }}
          />
          {airIndex > 0 ? (
            <div className="relative h-8 text-[0.85rem]" aria-hidden>
              <span
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
                style={{ left: `calc(15px + (100% - 30px) * ${airIndex / (SAMPLES - 1)})` }}
              >
                <span className="h-2.5 w-0.5 rounded bg-air" />
                <span className="text-air">air holds from here</span>
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-[0.98rem] font-medium text-ink">
            <span className="flex items-center gap-1.5">
              <Icon name="moon" size={17} className="text-battery" /> Save for tonight
            </span>
            <span className="flex items-center gap-1.5">
              Grow air and food <Icon name="sprout" size={17} className="text-food" />
            </span>
          </div>
          {!huddle ? (
            <p className="text-[0.85rem] text-ink-2">
              <span className="text-air">Green</span> is safe. <span className="text-sun">Yellow</span> leaves nothing spare.{" "}
              <span className="text-danger">Red</span> runs out before sunrise.
            </p>
          ) : null}
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`flex min-h-[3.5rem] items-center gap-3 rounded-[12px] px-4 py-3 text-[1.15rem] font-medium leading-snug ${ZONE_SOFT[tone]} ${ZONE_TEXT[tone]}`}
        >
          <Icon name={huddle ? "huddle" : zone === "good" ? "check" : "alert"} size={22} className="flex-none" />
          {planSentence(state, preview, value)}
        </p>

        <div className="flex gap-2">
          <Result label={<Num rule="keepAlive">Battery tonight</Num>} value={kWh(preview.batteryAtSunsetWh)} tone="var(--battery)" />
          <Result label={<Num rule="air">Air tomorrow</Num>} value={`${airAfter}%${airArrow}`} tone="var(--air)" />
          <Result label={<Num rule="crop">Crop</Num>} value={`${cropPct}%`} tone="var(--food)" />
        </div>
      </div>

      {/* 3. The emergency switch. */}
      <div className="flex items-center gap-4 rounded-[12px] border border-line px-4 py-3">
        <Icon name="huddle" size={22} className="flex-none text-ink-2" />
        <div className="flex-1">
          <p className="text-[1.02rem]">
            Emergency: <Num rule="huddle">huddle</Num> in one room
          </p>
          <p className="text-[0.9rem] text-ink-2">Much less power tonight. No greenhouse today.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={huddle}
          aria-label="Huddle in one room"
          onClick={() => dispatch({ type: "setBet", bet: { ...state.bet, huddle: !huddle } })}
          className="switch cursor-pointer"
          data-on={huddle}
        />
      </div>

      {state.problem ? <p className="rounded-[10px] bg-sun-soft px-3 py-2 text-[0.95rem]">{state.problem}</p> : null}

      {/* 4. Go. */}
      <div className="flex flex-col gap-2">
        {nudge ? <p className="text-[0.95rem] text-sun">Not sure? Mission Control can pick a safe plan.</p> : null}
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <button
            type="button"
            className={`btn btn-quiet w-full whitespace-nowrap ${nudge ? "border-sun text-sun" : ""}`}
            disabled={blackout}
            onClick={() => dispatch({ type: "setBet", bet: carefulBet(state) })}
          >
            <Icon name={blackout ? "noSignal" : "dish"} size={19} />
            {blackout ? "No signal from Earth" : "Ask Mission Control"}
          </button>
          <button type="button" className="btn btn-primary min-h-[60px] w-full text-xl font-semibold" onClick={lock}>
            Lock it in
          </button>
        </div>
      </div>
    </section>
  );
}

export function NightPanel({ state, dispatch }: Props) {
  const outcome = state.outcomes[state.outcomes.length - 1];
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setRevealed(true), reduced ? 50 : 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!outcome) return null;
  const goodNight = outcome.hoursCold === 0;
  const ending = state.ending !== null;

  return (
    <section aria-labelledby="night-title" aria-live="polite" className="grid gap-8 lg:grid-cols-[minmax(0,19rem)_1fr] lg:gap-10">
      <div className="lg:border-r lg:border-line lg:pr-10">
        <p className="flex items-center gap-2 text-[1.05rem]">
          <Icon name="thermo" size={19} className="text-dusk" /> Outside tonight
        </p>
        <div className="mt-3">
          <Thermometer dark actualC={revealed ? outcome.actualLowC : null} height={250} />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {!revealed ? (
          <div>
            <h2 id="night-title" className="text-[1.9rem] sm:text-[2.2rem]">
              Night falls
            </h2>
            <p className="mt-2 text-[1.05rem] text-ink-2">
              Reading the rover&apos;s thermometer
              <span className="waiting-dot">.</span>
              <span className="waiting-dot" style={{ animationDelay: "0.2s" }}>
                .
              </span>
              <span className="waiting-dot" style={{ animationDelay: "0.4s" }}>
                .
              </span>
            </p>
          </div>
        ) : (
          <>
            <div className="reveal">
              <p className="flex flex-wrap items-center gap-3 text-[0.92rem] text-ink-2">
                <span className="real-tag rounded-[4px] bg-sun px-2 py-0.5 text-[12px] font-medium text-on-action">Real data</span>
                Curiosity rover, sol {outcome.sol}, {niceDate(outcome.earthDate)}
              </p>
              <h2 id="night-title" className="mt-3 text-[1.9rem] sm:text-[2.4rem]">
                The real low was{" "}
                <Num rule="nightLow" className="readout text-sun">
                  {outcome.actualLowC} C
                </Num>
              </h2>
            </div>
            <div className="reveal max-w-[30rem]" style={{ animationDelay: "120ms" }}>
              <Row label="Battery at sunset" tone="var(--battery)">
                {kWh(outcome.batteryAtSunsetWh)}
              </Row>
              <Row label={<Num rule="keepAlive">The night needed</Num>}>{kWh(outcome.keepAliveWh)}</Row>
              <Row label="Hours in the cold" tone={goodNight ? "var(--air)" : "var(--danger)"}>
                {outcome.hoursCold}
              </Row>
            </div>
            <div className="reveal" style={{ animationDelay: "200ms" }}>
              <p className={`text-[1.4rem] ${goodNight ? "text-air" : "text-danger"}`}>
                {goodNight ? "Warm all night." : `${outcome.hoursCold} hours in the cold.`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-[1rem] text-ink-2">
                {outcome.story.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="reveal mt-auto flex flex-col gap-2" style={{ animationDelay: "280ms" }}>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <button className="btn btn-primary w-full text-lg" onClick={() => dispatch({ type: "nextSol" })} autoFocus>
                  {ending ? "See how you did" : "Next sol"}
                </button>
                {!ending ? (
                  <button className="btn btn-quiet w-full text-lg" onClick={() => dispatch({ type: "fastForward" })}>
                    <Icon name="forward" size={16} filled strokeWidth={0} /> Skip quiet sols
                  </button>
                ) : null}
              </div>
              {!ending ? <p className="text-[0.92rem] text-ink-2 sm:text-right">Repeats this plan until something changes.</p> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
