"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import type { Action, GameState, MissionId, Mode } from "@/contracts";
import { game } from "@/game";
import { BrainBay } from "./brain-bay";
import { OutpostScene } from "./crew";
import { DataCredits } from "./data-credits";
import { DebriefScreen } from "./debrief";
import { clearSave, loadGame, saveGame } from "./format";
import { Gauges } from "./gauges";
import { Icon } from "./icons";
import { ConjunctionArt, MarsScene } from "./mars-scene";
import { BetPanel, NightPanel, ReportPanel } from "./panels";
import { Num, RuleCardsProvider } from "./rule-cards";
import { NavLink, SiteNav } from "./site-nav";

type AppState = { game: GameState | null };
type AppAction = Action | { type: "start"; missionId: MissionId; seed: number; mode: Mode } | { type: "menu" };

function appReducer(app: AppState, action: AppAction): AppState {
  if (action.type === "start") return { game: game.start(action.missionId, action.seed, action.mode) };
  if (action.type === "menu") return { game: null };
  if (!app.game) return app;
  return { game: game.reduce(app.game, action) };
}

const newSeed = () => Math.floor(Math.random() * 90000) + 10000;

function initial(): AppState {
  const params = new URLSearchParams(window.location.search);
  if (params.get("continue") === "1") {
    const saved = loadGame();
    if (saved) return { game: saved };
  }
  return { game: null };
}

function Difficulty({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-2" aria-label={`Difficulty ${level} of 3`}>
      Difficulty
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i <= level ? "bg-rust" : "bg-[#3a3d42]"}`} />
        ))}
      </span>
    </span>
  );
}

function MissionSelect({ onStart }: { onStart: (missionId: MissionId, seed: number, mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>("guided");
  const [code, setCode] = useState("");
  const [codeProblem, setCodeProblem] = useState<string | null>(null);
  const missions = game.missions();

  const playCode = () => {
    const match = code.trim().match(/^([a-zA-Z0-9]+)-(\d+)$/);
    const mission = match ? missions.find((m) => m.id === match[1]) : undefined;
    if (!match || !mission) {
      setCodeProblem("That code doesn't match a mission. Codes look like dust2018-12345.");
      return;
    }
    onStart(mission.id, Number(match[2]), mode);
  };

  return (
    <div className="flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <h1 className="text-4xl sm:text-5xl">Choose a mission</h1>
        <div role="radiogroup" aria-label="Age" className="inline-flex w-fit rounded-full border border-line bg-card p-1">
          {(
            [
              ["guided", "Ages 7 to 9"],
              ["builder", "Ages 9 to 12"],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-11 rounded-full px-5 text-[0.98rem] font-medium transition-colors ${mode === value ? "bg-dusk text-on-action" : "text-ink hover:bg-[#2a2c30]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-3 text-ink-2">
        {mode === "guided"
          ? "Mission Control sends you a forecast every sol."
          : "You also get the Brain Bay, where you build your own forecast."}
      </p>

      <div className="grid gap-5 md:grid-cols-3">
        {missions.map((mission) => (
          <article key={mission.id} className="card flex flex-col overflow-hidden p-2.5">
            <div className="relative aspect-[5/2] overflow-hidden rounded-[10px] bg-deep">
              {mission.id === "conjunction2019" ? (
                <ConjunctionArt className="absolute inset-0 h-full w-full" />
              ) : (
                <MarsScene weather={mission.id === "dust2018" ? "Low" : "Very_High"} className="absolute inset-0 h-full w-full" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 px-2.5 pb-2.5 pt-4">
              <h2 className="text-2xl">{mission.title}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.95rem]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Icon name="book" size={17} className="text-ink-2" />
                  {mission.lengthSols} sols
                </span>
                <span className="h-4 w-px bg-line" aria-hidden />
                <Difficulty level={mission.difficulty} />
              </div>
              <p className="text-[0.98rem] text-ink-2">{mission.blurb}</p>
              {mission.realEvent ? (
                <p className="rounded-xl bg-haze px-3 py-2 text-[0.9rem] text-ink-2">
                  <span className="font-semibold text-ink">Really happened: </span>
                  {mission.realEvent}
                </p>
              ) : null}
              <button
                className="btn btn-primary mt-auto w-full"
                disabled={!mission.ready}
                onClick={() => onStart(mission.id, newSeed(), mode)}
              >
                {mission.ready ? "Start" : "Coming soon"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          playCode();
        }}
      >
        <label htmlFor="code" className="font-display text-xl sm:whitespace-nowrap">
          Have a mission code?
        </label>
        <input
          id="code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setCodeProblem(null);
          }}
          placeholder="Enter mission code"
          aria-describedby={codeProblem ? "code-problem" : undefined}
          className="min-h-12 flex-1 rounded-xl border border-line bg-haze px-4 text-ink placeholder:text-ink-2 focus:border-dusk"
        />
        <button className="btn btn-primary" type="submit">
          Play code
        </button>
        {codeProblem ? (
          <p id="code-problem" className="text-[0.95rem] text-danger sm:basis-full">
            {codeProblem}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function Outpost({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const [bayOpen, setBayOpen] = useState(false);
  const hasBay = state.availableTools.length > 0;
  const closeBay = useCallback(() => setBayOpen(false), []);

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink-2">{state.mission.title}</p>
          <h1 className="tnum text-3xl sm:text-4xl">
            <Num rule="mars-day">Sol</Num> {state.solIndex + 1} <span className="text-ink-2">of {state.mission.lengthSols}</span>
          </h1>
        </div>
        {hasBay ? (
          <button className="btn btn-quiet" onClick={() => setBayOpen(true)}>
            <Icon name="brain" size={20} className="text-dusk" />
            Brain Bay{state.design.tools.length > 0 ? ` (${state.design.tools.length})` : ""}
          </button>
        ) : null}
      </div>

      <OutpostScene state={state} />
      <Gauges outpost={state.outpost} />

      {state.problem && state.phase !== "bet" ? (
        <p className="rounded-2xl bg-sun-soft px-4 py-3" role="status">
          {state.problem}
        </p>
      ) : null}

      {state.phase === "report" ? <ReportPanel state={state} dispatch={dispatch} /> : null}
      {state.phase === "bet" ? <BetPanel state={state} dispatch={dispatch} /> : null}
      {state.phase === "night" ? <NightPanel key={state.outcomes.length} state={state} dispatch={dispatch} /> : null}

      {hasBay && bayOpen ? <BrainBay state={state} dispatch={dispatch} onClose={closeBay} /> : null}
    </div>
  );
}

export function MissionApp() {
  const [app, dispatch] = useReducer(appReducer, undefined, initial);
  const state = app.game;

  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  const screen = !state ? "menu" : state.phase === "ended" ? "ended" : "play";
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  return (
    <RuleCardsProvider>
      <SiteNav
        right={
          <>
            {state ? (
              <button
                className="rounded-xl px-3 py-2 text-ink-2 transition-colors hover:bg-card"
                onClick={() => dispatch({ type: "menu" })}
              >
                Missions
              </button>
            ) : (
              <NavLink href="/mission" active>
                Missions
              </NavLink>
            )}
            <NavLink href="/how-it-works">How it works</NavLink>
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6">
        {!state ? (
          <MissionSelect onStart={(missionId, seed, mode) => dispatch({ type: "start", missionId, seed, mode })} />
        ) : state.phase === "ended" ? (
          <DebriefScreen
            state={state}
            onPlayAgain={() => dispatch({ type: "start", missionId: state.mission.id, seed: newSeed(), mode: state.mode })}
            onMenu={() => {
              clearSave();
              dispatch({ type: "menu" });
            }}
          />
        ) : (
          <Outpost state={state} dispatch={dispatch} />
        )}
      </main>
      <DataCredits />
    </RuleCardsProvider>
  );
}
