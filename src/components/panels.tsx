"use client";

import { useEffect, useState, type Dispatch, type ReactNode } from "react";
import type { Action, ForecastPair, GameState } from "@/contracts";
import { game } from "@/game";
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

/** The forecast the player plans around: Mission Control first, the outpost computer when Earth is silent. */
function planningForecast(state: GameState): { pair: ForecastPair; from: string } | null {
  if (state.earthForecast) return { pair: state.earthForecast, from: "Mission Control" };
  if (state.outpostForecast) return { pair: state.outpostForecast, from: "Outpost computer" };
  return null;
}

const STEPS = [
  { phase: "report", label: "Morning report" },
  { phase: "bet", label: "Plan the day" },
  { phase: "night", label: "Night" },
] as const;

/** The console docked under the stage. Its strip shows where the sol is up to. */
export function Console({ state, children }: { state: GameState; children: ReactNode }) {
  const current = STEPS.findIndex((step) => step.phase === state.phase);
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
              className={`relative flex flex-1 items-center gap-2 px-3 py-3 sm:px-5 ${active ? "text-ink" : "text-ink-2"}`}
            >
              <span
                className={`readout grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] ${
                  active ? "bg-dusk text-on-action" : done ? "bg-[#33363b] text-ink" : "border border-line"
                }`}
              >
                {done ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className="truncate">{step.label}</span>
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

export function ReportPanel({ state, dispatch }: Props) {
  const low = lastNightLow(state);
  return (
    <section aria-labelledby="report-title" className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
      <div className="flex flex-col gap-4">
        <h2 id="report-title" className="text-[1.9rem] sm:text-[2.2rem]">
          Sunlight is <Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num> today.
        </h2>
        <p className="max-w-[36rem] text-[1.05rem] text-ink-2">
          {state.solIndex === 0 ? (
            <>
              A <Num rule="mars-day">sol</Num> is one day on Mars. Keep the crew safe for {state.mission.lengthSols} of them.{" "}
            </>
          ) : null}
          Decide how much of today&apos;s power goes to the greenhouse, and how much you save for tonight.
        </p>
        <div className="max-w-[30rem]">
          <Row label={<Num rule="solar">Panels collect today</Num>}>{kWh(state.solarWh)}</Row>
          <Row label="Battery now">{kWh(state.outpost.batteryWh)}</Row>
          {low != null ? <Row label={<Num rule="nightLow">Last night&apos;s real low</Num>}>{low} C</Row> : null}
          {state.computerWh > 0 ? <Row label="Outpost computer uses">{kWh(state.computerWh)}</Row> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3">
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
        <button className="btn btn-primary mt-auto w-full text-lg" onClick={() => dispatch({ type: "goToBet" })} autoFocus>
          Plan the day
        </button>
      </div>
    </section>
  );
}

export function BetPanel({ state, dispatch }: Props) {
  const plan = planningForecast(state);
  const assumeLow = plan ? plan.pair.nightLow.low : (lastNightLow(state) ?? -80);
  const preview = game.whatIf(state, state.bet, assumeLow);
  const max = state.maxGreenhouseWh;
  const value = state.bet.huddle ? 0 : state.bet.greenhouseWh;
  const fill = max > 0 ? (value / max) * 100 : 0;
  const cropPct = Math.min(100, Math.round((preview.cropLightAfterWh / Math.max(1, state.outpost.cropNeedsWh)) * 100));
  const lock = () => dispatch({ type: "lockBet" });
  const covers = preview.hoursCold === 0;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section aria-labelledby="bet-title" className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
      <div className="flex flex-col gap-6">
        <h2 id="bet-title" className="text-[1.9rem] sm:text-[2.2rem]">
          Plan the day
        </h2>

        <label className="flex flex-col gap-3">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 text-[1.05rem]">
              <Icon name="sprout" size={19} className="text-food" /> Greenhouse lights
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
            disabled={state.bet.huddle}
            style={{ ["--fill" as string]: `${fill}%` }}
            aria-valuetext={`${kWh(value)} for the greenhouse`}
            onChange={(event) => dispatch({ type: "setBet", bet: { ...state.bet, greenhouseWh: Number(event.target.value) } })}
            onKeyDown={(event) => {
              if (event.key === "Enter") lock();
            }}
          />
          <span className="relative -mt-1 h-2" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute top-0 h-1.5 w-px bg-[#4a4d53]" style={{ left: `calc(${t * 100}% - ${t}px)` }} />
            ))}
          </span>
          <span className="flex justify-between text-[0.92rem] text-ink-2">
            <span>Save power for tonight</span>
            <span>Grow air and food</span>
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
            aria-checked={state.bet.huddle}
            aria-label="Huddle in one room"
            onClick={() => dispatch({ type: "setBet", bet: { ...state.bet, huddle: !state.bet.huddle } })}
            className="switch cursor-pointer"
            data-on={state.bet.huddle}
          />
        </div>

        <div>
          <p className="mb-1 text-[13px] font-medium text-ink-2">If you lock this in</p>
          <Row label={<Num rule="keepAlive">Battery at sunset</Num>} tone="var(--battery)">
            {kWh(preview.batteryAtSunsetWh)}
          </Row>
          <Row label="Spare nights in the battery">{preview.spareNights}</Row>
          <Row label={<Num rule="air">Air tomorrow</Num>} tone="var(--air)">
            {Math.round(preview.airAfter)}%
          </Row>
          <Row label={<Num rule="crop">Crop grown</Num>} tone="var(--food)">
            {cropPct}%
          </Row>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:border-l lg:border-line lg:pl-10">
        <div>
          <p className="flex items-center gap-2 text-[1.05rem]">
            <Icon name="thermo" size={19} className="text-dusk" /> Tonight
          </p>
          <p className="text-[0.92rem] text-ink-2">
            {plan ? `${plan.from} forecast, and the coldest night your battery covers.` : "No forecast tonight. Plan for a cold one."}
          </p>
        </div>
        <Thermometer coveredDownToC={preview.coveredDownToC} forecast={plan ? plan.pair.nightLow : null} height={270} />
        <p className={`flex items-start gap-2.5 text-[0.98rem] ${covers ? "text-air" : "text-danger"}`}>
          <Icon name={covers ? "check" : "alert"} size={19} className="mt-0.5 flex-none" />
          {covers
            ? preview.coveredDownToC < -100
              ? "The battery covers even the coldest Mars night."
              : `The battery covers nights down to ${preview.coveredDownToC} C.`
            : `If tonight reaches ${Math.round(assumeLow)} C, power runs out ${preview.hoursCold} hours early. Try less light, or huddle.`}
        </p>
        {state.problem ? <p className="rounded-[10px] bg-sun-soft px-3 py-2 text-[0.95rem]">{state.problem}</p> : null}
        <button className="btn btn-primary mt-auto w-full text-lg" onClick={lock}>
          Lock it in
        </button>
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
            <div className="reveal mt-auto grid gap-3 sm:grid-cols-[2fr_1fr]" style={{ animationDelay: "280ms" }}>
              <button className="btn btn-primary w-full text-lg" onClick={() => dispatch({ type: "nextSol" })} autoFocus>
                {ending ? "See how you did" : "Next sol"}
              </button>
              {!ending ? (
                <button className="btn btn-quiet w-full text-lg" onClick={() => dispatch({ type: "fastForward" })}>
                  <Icon name="forward" size={16} filled strokeWidth={0} /> Fast-forward
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
