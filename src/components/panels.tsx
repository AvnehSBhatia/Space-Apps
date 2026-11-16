"use client";

import { useEffect, useState, type Dispatch, type ReactNode } from "react";
import type { Action, ForecastPair, GameState, WhatIf } from "@/contracts";
import { carefulBet, game } from "@/game";
import { SUNLIGHT_LEVEL_WORD, SUNLIGHT_WORD, kWh, niceDate } from "./format";
import { Icon } from "./icons";
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

function ForecastBlock({ from, pair }: { from: string; pair: ForecastPair }) {
  const night = pair.nightLow;
  return (
    <div className="rounded-[10px] border border-line bg-haze p-4">
      <p className="flex items-center gap-2 text-[0.92rem] text-ink-2">
        <Icon name={from === "Mission Control" ? "dish" : "cpu"} size={17} />
        {from} forecast
      </p>
      <p className="readout mt-2 text-[1.6rem] leading-none text-ink">{Math.round(night.value)} C</p>
      <p className="mt-1 text-[0.92rem] text-ink-2">
        Tonight, between <span className="readout text-ink">{Math.round(night.high)}</span> and{" "}
        <span className="readout text-ink">{Math.round(night.low)} C</span>
      </p>
      <p className="mt-2 border-t border-line pt-2 text-[0.92rem] text-ink-2">
        Tomorrow&apos;s sunlight:{" "}
        <span className="text-ink">{SUNLIGHT_LEVEL_WORD[Math.round(pair.sunlightTomorrow.value)] ?? "unknown"}</span>
      </p>
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

/** The whole day on one screen: today's sun, tonight's forecast, the plan, and one button. */
export function BetPanel({ state, dispatch }: Props) {
  const coldest = coldestForecast(state);
  const max = state.maxGreenhouseWh;
  const huddle = state.bet.huddle;
  const value = huddle ? 0 : state.bet.greenhouseWh;
  const preview = game.whatIf(state, state.bet, coldest);
  const zone = zoneOf(preview);
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

  return (
    <section aria-labelledby="today-title" className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-10">
      <div className="flex flex-col gap-4">
        <h2 id="today-title" className="text-[1.9rem] sm:text-[2.2rem]">
          Sunlight is <Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num> today.
        </h2>
        {state.solIndex === 0 ? (
          <p className="text-[1.05rem] text-ink-2">
            A <Num rule="mars-day">sol</Num> is one day on Mars. Keep the crew safe for {state.mission.lengthSols} of them.
          </p>
        ) : null}
        <div>
          <Row label={<Num rule="solar">Panels collect today</Num>}>{kWh(state.solarWh)}</Row>
          <Row label="Battery now">{kWh(state.outpost.batteryWh)}</Row>
          {low != null ? <Row label={<Num rule="nightLow">Last night&apos;s real low</Num>}>{low} C</Row> : null}
          {state.computerWh > 0 ? <Row label="Outpost computer uses">{kWh(state.computerWh)}</Row> : null}
        </div>
        {state.earthForecast ? (
          <ForecastBlock from="Mission Control" pair={state.earthForecast} />
        ) : (
          <div className="rounded-[10px] border border-dashed border-[#4a4d53] p-4">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Icon name="noSignal" size={18} className="text-dusk" /> No signal from Earth
            </p>
            <p className="mt-1.5 text-[0.95rem] text-ink-2">
              The Sun is between Mars and Earth, so Mission Control can&apos;t send a forecast.
              {!state.outpostForecast && state.availableTools.length > 0 ? " Install a tool in the Brain Bay to make your own." : ""}
            </p>
          </div>
        )}
        {state.outpostForecast ? <ForecastBlock from="Outpost computer" pair={state.outpostForecast} /> : null}
      </div>

      <div className="flex flex-col gap-5 lg:border-l lg:border-line lg:pl-10">
        <p
          role="status"
          aria-live="polite"
          className={`flex min-h-[4.25rem] items-center gap-3 rounded-[12px] px-4 py-3 text-[1.2rem] font-medium leading-snug ${ZONE_SOFT[zone]} ${ZONE_TEXT[zone]}`}
        >
          <Icon name={huddle ? "huddle" : zone === "good" ? "check" : "alert"} size={24} className="flex-none" />
          {planSentence(state, preview, value)}
        </p>

        <label className="flex flex-col gap-3">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 text-[1.05rem]">
              <Icon name="sprout" size={19} className="text-food" /> Power for the greenhouse lights
            </span>
            <span className="readout text-[1.05rem]">
              {kWh(value)} <span className="text-ink-2">/ {kWh(max)}</span>
            </span>
          </span>
          <input
            type="range"
            className="slider"
            min={0}
            max={max}
            step={500}
            value={value}
            disabled={huddle || max <= 0}
            style={{ background: track, height: 14 }}
            aria-valuetext={`${kWh(value)} for the greenhouse. ${planSentence(state, preview, value)}`}
            onChange={(event) => dispatch({ type: "setBet", bet: { ...state.bet, greenhouseWh: Number(event.target.value) } })}
            onKeyDown={(event) => {
              if (event.key === "Enter") lock();
            }}
            autoFocus
          />
          <span className="relative h-9 text-[0.85rem] text-ink-2" aria-hidden={airIndex <= 0}>
            {airIndex > 0 ? (
              <span
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
                style={{ left: `calc(15px + (100% - 30px) * ${airIndex / (SAMPLES - 1)})` }}
              >
                <span className="h-2.5 w-0.5 rounded bg-air" />
                <span className="text-air">air holds from here</span>
              </span>
            ) : null}
          </span>
          <span className="flex justify-between text-[0.98rem] font-medium text-ink">
            <span className="flex items-center gap-1.5">
              <Icon name="moon" size={17} className="text-battery" /> Save for tonight
            </span>
            <span className="flex items-center gap-1.5">
              Grow air and food <Icon name="sprout" size={17} className="text-food" />
            </span>
          </span>
        </label>

        <div className="flex items-center gap-4 rounded-[10px] border border-line px-4 py-3">
          <Icon name="huddle" size={22} className="flex-none text-ink-2" />
          <div className="flex-1">
            <p className="text-[1.05rem]">
              <Num rule="huddle">Huddle</Num> in one room
            </p>
            <p className="text-[0.92rem] text-ink-2">Uses far less power tonight. The greenhouse stays off.</p>
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

        <div>
          <p className="mb-1 text-[13px] font-medium text-ink-2">If you lock this in</p>
          <Row label={<Num rule="keepAlive">Battery at sunset</Num>} tone="var(--battery)">
            {kWh(preview.batteryAtSunsetWh)}
          </Row>
          <Row label={<Num rule="air">Air tomorrow</Num>} tone="var(--air)">
            {Math.round(preview.airAfter)}%
          </Row>
          <Row label={<Num rule="crop">Crop grown</Num>} tone="var(--food)">
            {cropPct}%
          </Row>
        </div>

        {state.problem ? <p className="rounded-[10px] bg-sun-soft px-3 py-2 text-[0.95rem]">{state.problem}</p> : null}

        <div className="mt-auto flex flex-col gap-3">
          {nudge ? <p className="text-[0.95rem] text-sun">Not sure? Mission Control can pick a safe plan.</p> : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <button
              type="button"
              className={`btn btn-quiet w-full ${nudge ? "border-sun text-sun" : ""}`}
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
