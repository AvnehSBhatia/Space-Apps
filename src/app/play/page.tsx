"use client";

// Plain test harness for the whole game loop. It uses only the contracts in src/contracts,
// so it keeps working while Parts A and C change their insides.
// Part B: build the real game UI in src/app and src/components, then delete or keep this as /play.

import { useReducer, useState } from "react";
import { brain } from "@/brain";
import { DataCredits } from "@/components/data-credits";
import type {
  Action,
  BrainDesign,
  CheckResult,
  Forecast,
  GameState,
  MissionId,
  Mode,
  TestFlight,
  ToolId,
} from "@/contracts";
import { game } from "@/game";

type PageAction = Action | { type: "restart"; missionId: MissionId; seed: number; mode: Mode };

function pageReducer(state: GameState, action: PageAction): GameState {
  if (action.type === "restart") return game.start(action.missionId, action.seed, action.mode);
  return game.reduce(state, action);
}

const kWh = (wh: number) => `${(wh / 1000).toFixed(1)} kWh`;
const SUNLIGHT_NAMES = ["", "Low", "Moderate", "High", "Very High"];

function describe(forecast: Forecast): string {
  if (forecast.target === "sunlight") {
    return `${SUNLIGHT_NAMES[Math.round(forecast.value)]} (${forecast.low} to ${forecast.high})`;
  }
  return `${forecast.value} C (${forecast.low} to ${forecast.high})`;
}

function Gauge({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono">{text}</span>
      </div>
      <div className="mt-2 h-2 rounded bg-white/10">
        <div className="h-2 rounded bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Checks({ title, results }: { title: string; results: CheckResult[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 space-y-1 font-mono text-xs">
        {results.map((result) => (
          <li key={result.name} className={result.pass ? "text-emerald-300" : "text-red-300"}>
            {result.pass ? "PASS" : "FAIL"} {result.name}
            {result.pass ? "" : `: ${result.detail}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Play() {
  const [state, dispatch] = useReducer(pageReducer, undefined, () => game.start("calm2016", 1, "builder"));
  const [flights, setFlights] = useState<{ nightLow: TestFlight; sunlight: TestFlight } | null>(null);
  const [checks, setChecks] = useState<{ brain: CheckResult[]; game: CheckResult[] } | null>(null);

  const { outpost } = state;
  const lastOutcome = state.outcomes[state.outcomes.length - 1];
  const installed = new Set(state.design.tools.map((tool) => tool.id));
  const forecast = state.earthForecast?.nightLow ?? state.outpostForecast?.nightLow ?? null;
  const preview = game.whatIf(state, state.bet, forecast ? forecast.low : -80);

  const restart = (missionId: MissionId, mode: Mode, seed: number) => {
    setFlights(null);
    dispatch({ type: "restart", missionId, seed, mode });
  };

  const toggleTool = (id: ToolId) => {
    const tools = installed.has(id)
      ? state.design.tools.filter((tool) => tool.id !== id)
      : [...state.design.tools, { uid: id, id, knobs: {} }];
    const design: BrainDesign = { tools };
    setFlights(null);
    dispatch({ type: "setDesign", design });
  };

  const runTestFlight = () => {
    setFlights({
      nightLow: brain.testFlight(state.design, state.history, "nightLowC", 30, state.seed),
      sunlight: brain.testFlight(state.design, state.history, "sunlight", 30, state.seed),
    });
  };

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-white/50">Test harness, not the final UI</p>
          <h1 className="text-3xl font-semibold">{state.mission.title}</h1>
          <p className="text-white/70">{state.mission.blurb}</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {game.missions().map((mission) => (
              <button
                key={mission.id}
                className="rounded border border-white/20 px-3 py-1 hover:bg-white/10"
                onClick={() => restart(mission.id, state.mode, state.seed)}
              >
                {mission.title}
              </button>
            ))}
            {(["guided", "builder", "lab"] as Mode[]).map((mode) => (
              <button
                key={mode}
                className={`rounded border px-3 py-1 ${state.mode === mode ? "border-emerald-400" : "border-white/20"}`}
                onClick={() => restart(state.mission.id, mode, state.seed)}
              >
                {mode}
              </button>
            ))}
            <button
              className="rounded border border-white/20 px-3 py-1 hover:bg-white/10"
              onClick={() => restart(state.mission.id, state.mode, Math.floor(Math.random() * 100000))}
            >
              New seed
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          <Gauge label="Crew" value={outpost.crewHealth} max={100} text={`${outpost.crewHealth}`} />
          <Gauge label="Battery" value={outpost.batteryWh} max={30000} text={kWh(outpost.batteryWh)} />
          <Gauge label="Air" value={outpost.airPercent} max={100} text={`${Math.round(outpost.airPercent)}%`} />
          <Gauge
            label={`Food: ${outpost.meals} meals`}
            value={outpost.cropLightWh}
            max={outpost.cropNeedsWh}
            text={`crop ${Math.round((outpost.cropLightWh / outpost.cropNeedsWh) * 100)}%`}
          />
        </section>

        <section className="rounded-lg border border-white/10 p-4 text-sm">
          <p className="font-medium">
            Sol {state.solIndex + 1} of {state.mission.lengthSols} (rover sol {state.todaySol}, {state.todayEarthDate})
          </p>
          <ul className="mt-2 space-y-1 text-white/80">
            <li>
              Sunlight today: {state.sunlight.replace("_", " ")}, so the panels collect {kWh(state.solarWh)}
            </li>
            <li>Contact with Earth: {state.contact}</li>
            <li>
              Mission Control forecast:{" "}
              {state.earthForecast
                ? `tonight ${describe(state.earthForecast.nightLow)}, tomorrow ${describe(state.earthForecast.sunlightTomorrow)}`
                : "none (blackout)"}
            </li>
            <li>
              Outpost computer forecast:{" "}
              {state.outpostForecast
                ? `tonight ${describe(state.outpostForecast.nightLow)}, tomorrow ${describe(state.outpostForecast.sunlightTomorrow)}`
                : "no tools installed"}
            </li>
            <li>Computer power today: {kWh(state.computerWh)}</li>
          </ul>
          {state.problem ? <p className="mt-2 text-red-300">{state.problem}</p> : null}
        </section>

        {state.phase === "report" ? (
          <button className="rounded bg-emerald-500 px-4 py-3 font-medium text-black" onClick={() => dispatch({ type: "goToBet" })}>
            Plan the day
          </button>
        ) : null}

        {state.phase === "bet" ? (
          <section className="flex flex-col gap-3 rounded-lg border border-white/10 p-4 text-sm">
            <label className="flex flex-col gap-1">
              <span>
                Greenhouse lights: {kWh(state.bet.greenhouseWh)} of {kWh(state.maxGreenhouseWh)}
              </span>
              <input
                type="range"
                min={0}
                max={state.maxGreenhouseWh}
                step={500}
                value={state.bet.greenhouseWh}
                disabled={state.bet.huddle}
                onChange={(event) =>
                  dispatch({ type: "setBet", bet: { ...state.bet, greenhouseWh: Number(event.target.value) } })
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.bet.huddle}
                onChange={(event) => dispatch({ type: "setBet", bet: { ...state.bet, huddle: event.target.checked } })}
              />
              Huddle in one room (greenhouse off today)
            </label>
            <ul className="space-y-1 text-white/80">
              <li>Battery at sunset: {kWh(preview.batteryAtSunsetWh)}</li>
              <li>That covers nights down to {preview.coveredDownToC} C</li>
              <li>
                If tonight is as cold as the forecast allows: {preview.hoursCold} hours without power, air{" "}
                {Math.round(preview.airAfter)}%
              </li>
            </ul>
            <button className="rounded bg-emerald-500 px-4 py-3 font-medium text-black" onClick={() => dispatch({ type: "lockBet" })}>
              Lock it in
            </button>
          </section>
        ) : null}

        {state.phase === "night" && lastOutcome ? (
          <section className="flex flex-col gap-3 rounded-lg border border-white/10 p-4 text-sm">
            <p className="font-medium">
              The real overnight low was {lastOutcome.actualLowC} C. The night needed {kWh(lastOutcome.keepAliveWh)}.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
              {lastOutcome.story.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button className="rounded bg-emerald-500 px-4 py-3 font-medium text-black" onClick={() => dispatch({ type: "nextSol" })}>
                Next sol
              </button>
              <button className="rounded border border-white/20 px-4 py-3" onClick={() => dispatch({ type: "fastForward" })}>
                Fast-forward
              </button>
            </div>
          </section>
        ) : null}

        {state.phase === "ended" ? (
          <section className="flex flex-col gap-2 rounded-lg border border-emerald-400/40 p-4 text-sm">
            <p className="text-lg font-medium">{game.debrief(state).headline}</p>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
              {game.debrief(state).lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>
              Your score: {state.score.total}. A careful commander scored {game.debrief(state).carefulCommander.total}.
            </p>
          </section>
        ) : null}

        {state.availableTools.length > 0 ? (
          <section className="flex flex-col gap-3 rounded-lg border border-white/10 p-4 text-sm">
            <p className="font-medium">Brain Bay</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {brain
                .catalog()
                .filter((tool) => state.availableTools.includes(tool.id))
                .map((tool) => (
                  <button
                    key={tool.id}
                    disabled={!tool.ready || (state.phase !== "report" && state.phase !== "bet")}
                    className={`rounded border p-3 text-left disabled:opacity-40 ${
                      installed.has(tool.id) ? "border-emerald-400 bg-emerald-400/10" : "border-white/20"
                    }`}
                    onClick={() => toggleTool(tool.id)}
                  >
                    <span className="font-medium">{tool.name}</span>{" "}
                    <span className="text-xs text-white/50">
                      {tool.realName}, {kWh(tool.energyWhPerSol)} a sol{tool.ready ? "" : ", not built yet"}
                    </span>
                    <span className="mt-1 block text-white/70">{tool.blurb}</span>
                  </button>
                ))}
            </div>
            <button className="self-start rounded border border-white/20 px-3 py-2" onClick={runTestFlight}>
              Test flight on the last 30 sols
            </button>
            {flights ? (
              <ul className="space-y-1 font-mono text-xs text-white/80">
                <li>
                  Tonight low: off by {flights.nightLow.averageMiss} C, give or take {flights.nightLow.missNoise}. Copycat
                  alone: {flights.nightLow.copycatMiss} C.
                </li>
                <li>
                  Sunlight tomorrow: off by {flights.sunlight.averageMiss} levels, give or take {flights.sunlight.missNoise}.
                  Copycat alone: {flights.sunlight.copycatMiss}.
                </li>
                {flights.nightLow.toolHelp.map((help) => (
                  <li key={help.uid}>
                    {help.uid}: {help.help > 0 ? "helps" : "does not help"} ({help.help} C)
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-lg border border-white/10 p-4 text-sm">
          <button
            className="self-start rounded border border-white/20 px-3 py-2"
            onClick={() => setChecks({ brain: brain.selfCheck(), game: game.selfCheck() })}
          >
            Run self-checks
          </button>
          {checks ? (
            <>
              <Checks title="Part A: brain" results={checks.brain} />
              <Checks title="Part C: game" results={checks.game} />
            </>
          ) : null}
        </section>
      </main>
      <DataCredits />
    </>
  );
}
