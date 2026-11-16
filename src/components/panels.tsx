"use client";

import { useEffect, useState, type Dispatch } from "react";
import type { Action, ForecastPair, GameState } from "@/contracts";
import { game } from "@/game";
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

/** The forecast the player plans around: Mission Control first, the outpost computer when Earth is silent. */
function planningForecast(state: GameState): { pair: ForecastPair; from: string } | null {
  if (state.earthForecast) return { pair: state.earthForecast, from: "Mission Control" };
  if (state.outpostForecast) return { pair: state.outpostForecast, from: "Outpost computer" };
  return null;
}

function ForecastRow({ from, pair }: { from: string; pair: ForecastPair }) {
  const night = pair.nightLow;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-dusk-soft px-4 py-3">
      <Icon name={from === "Mission Control" ? "dish" : "cpu"} size={24} className="mt-0.5 flex-none text-dusk" />
      <p>
        <span className="font-semibold">{from} forecast: </span>
        tonight about <span className="tnum font-semibold">{Math.round(night.value)} C</span>, between{" "}
        <span className="tnum">{Math.round(night.high)}</span> and <span className="tnum">{Math.round(night.low)} C</span>. Tomorrow&apos;s
        sunlight: {SUNLIGHT_LEVEL_WORD[Math.round(pair.sunlightTomorrow.value)] ?? "unknown"}.
      </p>
    </div>
  );
}

export function ReportPanel({ state, dispatch }: Props) {
  const low = lastNightLow(state);
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-7" aria-labelledby="report-title">
      <div className="flex items-center gap-3">
        <Icon name="sun" size={30} className="text-sun" />
        <h2 id="report-title" className="text-3xl font-bold">
          Morning report
        </h2>
      </div>
      {state.solIndex === 0 ? (
        <p className="text-ink-2">
          A <Num rule="mars-day">sol</Num> is one day on Mars. You have {state.mission.lengthSols} sols to keep the crew safe.
        </p>
      ) : null}
      <p className="text-xl sm:text-2xl">
        Sunlight today is <Num rule="sunlight" className="font-semibold">{SUNLIGHT_WORD[state.sunlight]}</Num>. The panels
        collect <Num rule="solar" className="font-semibold">{kWh(state.solarWh)}</Num>.
      </p>
      {low != null ? (
        <p className="text-ink-2">
          Last night&apos;s real low was <Num rule="nightLow" className="font-semibold text-ink">{low} C</Num>.
        </p>
      ) : null}
      {state.earthForecast ? <ForecastRow from="Mission Control" pair={state.earthForecast} /> : null}
      {!state.earthForecast ? (
        <div className="flex items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white">
          <Icon name="noSignal" size={24} className="mt-0.5 flex-none text-sun" />
          <p>
            <span className="font-semibold">No signal from Earth. </span>
            The Sun is between Mars and Earth, so Mission Control can&apos;t send a forecast.
            {!state.outpostForecast && state.availableTools.length > 0 ? " Install a tool in the Brain Bay to make your own." : ""}
          </p>
        </div>
      ) : null}
      {state.outpostForecast ? <ForecastRow from="Outpost computer" pair={state.outpostForecast} /> : null}
      {state.computerWh > 0 ? (
        <p className="text-[0.95rem] text-ink-2">The outpost computer uses {kWh(state.computerWh)} today.</p>
      ) : null}
      <button className="btn btn-primary mt-1 w-full text-lg" onClick={() => dispatch({ type: "goToBet" })} autoFocus>
        Plan the day
      </button>
    </section>
  );
}

function Tile({ icon, tone, bg, label, children }: { icon: IconName; tone: string; bg: string; label: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${bg}`}>
      <Icon name={icon} size={28} style={{ color: tone }} className="flex-none" />
      <div className="leading-tight">
        <p className="text-[0.95rem] font-semibold text-ink-2">{label}</p>
        <p className="tnum font-display text-2xl font-bold">{children}</p>
      </div>
    </div>
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

  return (
    <section className="card p-5 sm:p-7" aria-labelledby="bet-title">
      <h2 id="bet-title" className="text-3xl font-bold">
        Plan the day
      </h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-0">
        <div className="flex flex-col gap-5 lg:border-r lg:border-line lg:pr-8">
          <label className="flex gap-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-food-soft text-food">
              <Icon name="sprout" size={26} />
            </span>
            <span className="flex flex-1 flex-col gap-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-xl font-bold">Greenhouse lights</span>
                <span className="tnum text-lg">
                  <span className="font-bold">{kWh(value)}</span> <span className="text-ink-2">of {kWh(max)}</span>
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
              <span className="flex justify-between text-[0.95rem] text-ink-2">
                <span>Save power</span>
                <span>Grow food</span>
              </span>
            </span>
          </label>

          <div className="flex items-center gap-4 border-y border-line py-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-dusk-soft text-dusk">
              <Icon name="huddle" size={24} />
            </span>
            <div className="flex-1">
              <p className="font-display text-xl font-bold">
                <Num rule="huddle">Huddle</Num> in one room
              </p>
              <p className="text-[0.95rem] text-ink-2">Less power tonight, greenhouse off</p>
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

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Tile icon="bolt" tone="var(--battery)" bg="bg-battery-soft" label="Battery at sunset">
              <Num rule="keepAlive">{kWh(preview.batteryAtSunsetWh)}</Num>
            </Tile>
            <Tile icon="moon" tone="var(--sun)" bg="bg-sun-soft" label="Spare nights">
              {preview.spareNights}
            </Tile>
            <Tile icon="air" tone="var(--air)" bg="bg-air-soft" label="Air tomorrow">
              <Num rule="air">{Math.round(preview.airAfter)}%</Num>
            </Tile>
            <Tile icon="sprout" tone="var(--food)" bg="bg-food-soft" label="Crop">
              <Num rule="crop">{cropPct}%</Num>
            </Tile>
          </div>

          <p
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 font-semibold ${covers ? "bg-air-soft text-[#0E6B54]" : "bg-danger-soft text-[#A3203F]"}`}
          >
            <Icon name={covers ? "check" : "alert"} size={22} className="mt-0.5 flex-none" />
            {covers
              ? preview.coveredDownToC < -100
                ? "The battery covers even the coldest Mars night."
                : `The battery covers nights down to ${preview.coveredDownToC} C.`
              : `If tonight reaches ${Math.round(assumeLow)} C, power runs out ${preview.hoursCold} hours early. Try less light, or huddle.`}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:pl-8">
          <div className="flex items-start gap-3">
            <Icon name="thermo" size={28} className="mt-0.5 text-rust" />
            <div>
              <p className="font-display text-xl font-bold">Tonight</p>
              <p className="text-[0.95rem] text-ink-2">
                {plan ? `${plan.from} forecast and the coldest night your battery covers.` : "No forecast tonight. Plan for a cold one."}
              </p>
            </div>
          </div>
          <Thermometer coveredDownToC={preview.coveredDownToC} forecast={plan ? plan.pair.nightLow : null} height={290} />
          {state.problem ? <p className="rounded-xl bg-sun-soft px-3 py-2 text-[0.95rem]">{state.problem}</p> : null}
          <button className="btn btn-primary mt-auto w-full text-lg lg:ml-auto lg:w-auto lg:px-10" onClick={lock}>
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
    <section className="rounded-[22px] bg-ink p-5 text-white sm:p-7" aria-labelledby="night-title" aria-live="polite">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-0">
        <div className="lg:border-r lg:border-white/15 lg:pr-8">
          <h2 id="night-title" className="text-3xl font-bold">
            Night falls
          </h2>
          <p className="mb-4 text-white/65">Temperature outside</p>
          <Thermometer dark actualC={revealed ? outcome.actualLowC : null} height={260} />
        </div>
        <div className="flex flex-col gap-4 lg:pl-8">
          {!revealed ? (
            <p className="text-2xl text-white/80">
              Waiting for sunrise
              <span className="waiting-dot">.</span>
              <span className="waiting-dot" style={{ animationDelay: "0.2s" }}>
                .
              </span>
              <span className="waiting-dot" style={{ animationDelay: "0.4s" }}>
                .
              </span>
            </p>
          ) : (
            <>
              <div className="reveal flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="font-display text-3xl font-bold sm:text-4xl">
                  The real low was <Num rule="nightLow">{outcome.actualLowC} C</Num>
                </p>
                <span className="real-tag rounded-lg bg-sun px-2.5 py-1 text-[0.95rem] font-bold text-ink">Real data</span>
              </div>
              <p className="reveal -mt-2 text-white/70">
                Curiosity rover, sol {outcome.sol}, {niceDate(outcome.earthDate)}
              </p>
              <div className="reveal grid gap-3 min-[420px]:grid-cols-2" style={{ animationDelay: "120ms" }}>
                <div className="flex items-center gap-3 rounded-2xl border border-white/20 px-4 py-3">
                  <Icon name="bolt" size={26} className="text-battery" />
                  <div className="leading-tight">
                    <p className="text-[0.95rem] text-white/70">Battery at sunset</p>
                    <p className="tnum font-display text-2xl font-bold">{kWh(outcome.batteryAtSunsetWh)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/20 px-4 py-3">
                  <Icon name="moon" size={26} className="text-sun" />
                  <div className="leading-tight">
                    <p className="text-[0.95rem] text-white/70">Night needed</p>
                    <p className="tnum font-display text-2xl font-bold">
                      <Num rule="keepAlive">{kWh(outcome.keepAliveWh)}</Num>
                    </p>
                  </div>
                </div>
              </div>
              <p
                className={`reveal font-display text-2xl font-bold ${goodNight ? "text-air" : "text-[#FF8FA6]"}`}
                style={{ animationDelay: "200ms" }}
              >
                {goodNight ? "Warm all night." : `${outcome.hoursCold} hours in the cold.`}
              </p>
              <ul className="reveal flex flex-col gap-1 text-white/85" style={{ animationDelay: "260ms" }}>
                {outcome.story.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="reveal mt-2 grid gap-3 sm:grid-cols-2" style={{ animationDelay: "320ms" }}>
                <button className="btn btn-primary w-full text-lg" onClick={() => dispatch({ type: "nextSol" })} autoFocus>
                  {ending ? "See how you did" : "Next sol"}
                </button>
                {!ending ? (
                  <button className="btn btn-ghost-dark w-full text-lg" onClick={() => dispatch({ type: "fastForward" })}>
                    <Icon name="forward" size={18} filled strokeWidth={0} /> Fast-forward
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
