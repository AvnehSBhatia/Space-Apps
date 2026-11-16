"use client";

import { useEffect, useState, type Dispatch } from "react";
import type { Action, Forecast, ForecastPair, GameState } from "@/contracts";
import { game } from "@/game";
import { SUNLIGHT_LEVEL_WORD, SUNLIGHT_WORD, kWh, niceDate } from "./format";
import { Num } from "./rule-cards";
import { Thermometer } from "./thermometer";

type Props = { state: GameState; dispatch: Dispatch<Action> };

const panelBase = "chunk pop-in flex flex-col gap-4 p-4 sm:p-6";
const panelClass = `${panelBase} bg-cream text-ink`;

function lastNightLow(state: GameState): number | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const low = state.history[i].minTempC;
    if (low != null) return low;
  }
  return null;
}

/** The forecast the player should plan around: Mission Control first, the outpost computer when Earth is silent. */
export function planningForecast(state: GameState): { pair: ForecastPair; from: string } | null {
  if (state.earthForecast) return { pair: state.earthForecast, from: "Mission Control" };
  if (state.outpostForecast) return { pair: state.outpostForecast, from: "Outpost computer" };
  return null;
}

function ForecastLine({ label, pair }: { label: string; pair: ForecastPair }) {
  const night: Forecast = pair.nightLow;
  const sun: Forecast = pair.sunlightTomorrow;
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-white p-3">
      <p className="font-display text-lg font-extrabold">📡 {label} says</p>
      <p>
        Tonight: about <span className="tnum font-bold">{Math.round(night.value)} C</span>{" "}
        <span className="text-ink/70">
          (between <span className="tnum">{Math.round(night.low)}</span> and <span className="tnum">{Math.round(night.high)}</span> C)
        </span>
      </p>
      <p>
        Tomorrow&apos;s sunlight: <span className="font-bold">{SUNLIGHT_LEVEL_WORD[Math.round(sun.value)] ?? "?"}</span>
      </p>
    </div>
  );
}

export function ReportPanel({ state, dispatch }: Props) {
  const low = lastNightLow(state);
  return (
    <section className={panelClass} aria-labelledby="report-title">
      <h2 id="report-title" className="font-display text-2xl font-extrabold">
        ☀️ Morning report
      </h2>
      {state.solIndex === 0 ? (
        <p className="rounded-2xl bg-sun/40 px-3 py-2">
          A <Num rule="mars-day">sol</Num> is one day on Mars. You have {state.mission.lengthSols} sols to keep the crew safe.
        </p>
      ) : null}
      <p className="text-xl">
        Sunlight today: <Num rule="sunlight" className="font-bold">{SUNLIGHT_WORD[state.sunlight]}</Num>. The panels collect{" "}
        <Num rule="solar" className="font-bold">{kWh(state.solarWh)}</Num>.
      </p>
      {low != null ? (
        <p>
          Last night&apos;s real low: <Num rule="nightLow" className="font-bold">{low} C</Num>
        </p>
      ) : null}
      {state.earthForecast ? (
        <ForecastLine label="Mission Control" pair={state.earthForecast} />
      ) : (
        <div className="rounded-2xl border-[3px] border-dashed border-ink bg-indigo p-3 text-cream">
          <p className="font-display text-lg font-extrabold">📵 No signal from Earth</p>
          <p>The Sun is between Mars and Earth. Mission Control cannot send a forecast.</p>
          {!state.outpostForecast && state.availableTools.length > 0 ? (
            <p className="mt-1">Install a tool in the Brain Bay to make your own forecast.</p>
          ) : null}
        </div>
      )}
      {state.outpostForecast ? <ForecastLine label="Outpost computer" pair={state.outpostForecast} /> : null}
      {state.computerWh > 0 ? (
        <p className="text-base text-ink/80">The outpost computer uses {kWh(state.computerWh)} today.</p>
      ) : null}
      <button className="btn btn-primary w-full" onClick={() => dispatch({ type: "goToBet" })} autoFocus>
        Plan the day
      </button>
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
  const cropPct = Math.round((preview.cropLightAfterWh / Math.max(1, state.outpost.cropNeedsWh)) * 100);
  const lock = () => dispatch({ type: "lockBet" });

  return (
    <section className={panelClass} aria-labelledby="bet-title">
      <h2 id="bet-title" className="font-display text-2xl font-extrabold">
        🌱 Plan the day
      </h2>
      <div className="grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-3">
            <span className="text-lg">
              Greenhouse lights: <span className="tnum font-bold">{kWh(value)}</span>{" "}
              <span className="text-ink/70">of {kWh(max)}</span>
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
            <span className="flex justify-between text-sm text-ink/70">
              <span>🔋 Save it all</span>
              <span>🌱 Grow lots</span>
            </span>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={state.bet.huddle}
            onClick={() => dispatch({ type: "setBet", bet: { ...state.bet, huddle: !state.bet.huddle } })}
            className={`btn w-full justify-between ${state.bet.huddle ? "btn-sun" : "btn-cream"}`}
          >
            <span>🛏️ Huddle in one room</span>
            <span className="rounded-full border-2 border-ink bg-white px-3 text-base">{state.bet.huddle ? "ON" : "OFF"}</span>
          </button>
          <p className="-mt-2 text-base text-ink/80">
            <Num rule="huddle">Huddle</Num> uses much less power tonight, but the greenhouse stays dark.
          </p>

          <ul className="grid grid-cols-2 gap-2 text-base">
            <li className="rounded-2xl border-2 border-ink bg-blue/30 p-2">
              🔋 Battery at sunset
              <br />
              <Num rule="keepAlive" className="font-bold">{kWh(preview.batteryAtSunsetWh)}</Num>
            </li>
            <li className="rounded-2xl border-2 border-ink bg-blue/30 p-2">
              🌙 Spare nights
              <br />
              <span className="tnum font-bold">{preview.spareNights}</span>
            </li>
            <li className="rounded-2xl border-2 border-ink bg-mint/40 p-2">
              💨 Air tomorrow
              <br />
              <Num rule="air" className="font-bold">{Math.round(preview.airAfter)}%</Num>
            </li>
            <li className="rounded-2xl border-2 border-ink bg-leaf/40 p-2">
              🌱 Crop after
              <br />
              <Num rule="crop" className="font-bold">{Math.min(100, cropPct)}%</Num>
            </li>
          </ul>
          {preview.hoursCold > 0 ? (
            <p className="rounded-2xl border-[3px] border-ink bg-berry/25 p-2 font-bold">
              ⚠️ If tonight is as cold as {Math.round(assumeLow)} C, the power runs out {preview.hoursCold} hours early. Try less
              greenhouse light or a huddle.
            </p>
          ) : (
            <p className="rounded-2xl border-[3px] border-ink bg-mint/40 p-2 font-bold">
              {preview.coveredDownToC < -100
                ? "✓ The battery covers even the coldest Mars night."
                : `✓ The battery covers nights down to ${preview.coveredDownToC} C.`}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-indigo p-3 text-cream">
          <p className="mb-2 text-sm font-bold">Tonight</p>
          <Thermometer coveredDownToC={preview.coveredDownToC} forecast={plan ? plan.pair.nightLow : null} />
          {plan ? (
            <p className="mt-1 flex items-center gap-1 text-sm">
              <span className="inline-block h-3 w-4 border-2 border-dashed border-ink bg-sun" aria-hidden /> {plan.from} forecast
            </p>
          ) : null}
        </div>
      </div>
      {state.problem ? <p className="rounded-2xl bg-sun/50 p-2">🤔 {state.problem}</p> : null}
      <button className="btn btn-primary w-full" onClick={lock}>
        Lock it in
      </button>
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
    <section className={`${panelBase} bg-[#1F2556] text-cream`} aria-labelledby="night-title" aria-live="polite">
      <h2 id="night-title" className="font-display text-2xl font-extrabold">
        🌙 Night falls
      </h2>
      <div className="grid gap-5 md:grid-cols-[auto_1fr]">
        <div className="rounded-2xl bg-indigo p-3">
          <Thermometer actualC={revealed ? outcome.actualLowC : null} />
        </div>
        <div className="flex flex-col gap-3">
          {!revealed ? (
            <p className="text-xl">
              The crew waits for morning
              <span className="dot-pulse">.</span>
              <span className="dot-pulse" style={{ animationDelay: "0.2s" }}>
                .
              </span>
              <span className="dot-pulse" style={{ animationDelay: "0.4s" }}>
                .
              </span>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl">
                  The real low was <Num rule="nightLow" className="font-display font-extrabold">{outcome.actualLowC} C</Num>
                </p>
                <span className="stamp rounded-lg border-[3px] border-sun px-2 font-display text-lg font-extrabold uppercase text-sun">
                  Real data
                </span>
              </div>
              <p className="text-sm text-cream/80">
                Curiosity rover, sol {outcome.sol}, {niceDate(outcome.earthDate)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-base">
                <div className="rounded-2xl border-2 border-cream/40 p-2">
                  🔋 Battery at sunset
                  <br />
                  <span className="tnum font-bold">{kWh(outcome.batteryAtSunsetWh)}</span>
                </div>
                <div className="rounded-2xl border-2 border-cream/40 p-2">
                  🌙 Night needed
                  <br />
                  <Num rule="keepAlive" className="font-bold">{kWh(outcome.keepAliveWh)}</Num>
                </div>
              </div>
              <p className={`rounded-2xl border-[3px] border-ink p-2 font-bold text-ink ${goodNight ? "bg-mint" : "bg-berry"}`}>
                {goodNight ? "✓ Warm all night." : `🥶 ${outcome.hoursCold} hours in the cold.`}
              </p>
              <ul className="flex flex-col gap-1">
                {outcome.story.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {revealed ? (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <button className="btn btn-primary w-full" onClick={() => dispatch({ type: "nextSol" })} autoFocus>
            {ending ? "See how you did" : "Next sol"}
          </button>
          {!ending ? (
            <button className="btn btn-cream w-full" onClick={() => dispatch({ type: "fastForward" })}>
              ⏩ Fast-forward
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
