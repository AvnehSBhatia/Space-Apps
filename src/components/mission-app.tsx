"use client";

import Link from "next/link";
import { useEffect, useReducer, useState } from "react";
import type { Action, GameState, MissionId, Mode } from "@/contracts";
import { game } from "@/game";
import { BrainBay } from "./brain-bay";
import { Habitat, Sky } from "./crew";
import { DataCredits } from "./data-credits";
import { DebriefScreen } from "./debrief";
import { SUNLIGHT_WORD, clearSave, loadGame, niceDate, saveGame } from "./format";
import { Gauges } from "./gauges";
import { BetPanel, NightPanel, ReportPanel } from "./panels";
import { Num, RuleCardsProvider } from "./rule-cards";

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

const DIFFICULTY = ["", "⭐", "⭐⭐", "⭐⭐⭐"];

function MissionSelect({ onStart }: { onStart: (missionId: MissionId, seed: number, mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>("guided");
  const [code, setCode] = useState("");
  const [codeProblem, setCodeProblem] = useState<string | null>(null);
  const missions = game.missions();

  const playCode = () => {
    const match = code.trim().match(/^([a-zA-Z0-9]+)-(\d+)$/);
    const mission = match ? missions.find((m) => m.id === match[1]) : undefined;
    if (!match || !mission) {
      setCodeProblem("That code does not look right. It looks like dust2018-12345.");
      return;
    }
    onStart(mission.id, Number(match[2]), mode);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold">Pick a mission</h1>
        <p className="text-cream/85">Each mission is a real stretch of weather from the Curiosity rover.</p>
      </header>

      <fieldset className="chunk flex flex-col gap-3 bg-indigo p-4">
        <legend className="sr-only">How old are you?</legend>
        <p className="font-display text-xl font-extrabold">How old are you?</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["guided", "7 to 9", "Mission Control helps you."],
              ["builder", "9 to 12", "Build your own forecast too."],
            ] as [Mode, string, string][]
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`btn w-full flex-col py-2 ${mode === value ? "btn-sun" : "btn-cream"}`}
            >
              <span>{label}</span>
              <span className="font-sans text-sm font-semibold">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        {missions.map((mission) => (
          <article key={mission.id} className="chunk flex flex-col gap-3 bg-cream p-4 text-ink">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" aria-label={`Difficulty ${mission.difficulty} of 3`}>
                {DIFFICULTY[mission.difficulty]}
              </span>
              <span className="tnum rounded-full border-2 border-ink bg-sun px-2 text-sm font-bold">{mission.lengthSols} sols</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold leading-tight">{mission.title}</h2>
            <p className="text-base">{mission.blurb}</p>
            {mission.realEvent ? (
              <p className="rounded-2xl bg-blue/25 p-2 text-sm">
                <span className="font-bold">🛰️ Really happened: </span>
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
          </article>
        ))}
      </div>

      <form
        className="chunk flex flex-col gap-2 bg-indigo p-4"
        onSubmit={(event) => {
          event.preventDefault();
          playCode();
        }}
      >
        <label htmlFor="code" className="font-display text-xl font-extrabold">
          Got a mission code from a friend?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setCodeProblem(null);
            }}
            placeholder="dust2018-12345"
            className="min-h-14 flex-1 rounded-2xl border-[3px] border-ink bg-cream px-4 text-lg text-ink placeholder:text-ink/40"
          />
          <button className="btn btn-sun" type="submit">
            Play this code
          </button>
        </div>
        {codeProblem ? <p className="text-sun">🤔 {codeProblem}</p> : null}
      </form>
    </div>
  );
}

function Outpost({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const [bayOpen, setBayOpen] = useState(false);
  const hasBay = state.availableTools.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="chunk overflow-hidden bg-indigo">
        <Sky sunlight={state.sunlight}>
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 sm:left-5">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide text-ink/80">{state.mission.title}</p>
            <p className="tnum w-fit rounded-full border-[3px] border-ink bg-cream px-3 font-display text-xl font-extrabold text-ink">
              <Num rule="mars-day">Sol</Num> {state.solIndex + 1} of {state.mission.lengthSols}
            </p>
            <p className="w-fit rounded-full bg-cream/85 px-2 text-sm font-bold text-ink">
              Earth date: {niceDate(state.todayEarthDate)}
            </p>
          </div>
          <p className="absolute right-3 top-[76px] z-10 rounded-full border-2 border-ink bg-cream px-2 text-sm font-bold text-ink sm:right-5">
            ☀️ <Num rule="sunlight">{SUNLIGHT_WORD[state.sunlight]}</Num>
          </p>
          <Habitat state={state} />
        </Sky>
      </div>

      <Gauges outpost={state.outpost} />

      {state.problem && state.phase !== "bet" ? (
        <p className="chunk bg-sun p-3 text-ink" role="status">
          🤔 {state.problem}
        </p>
      ) : null}

      {hasBay && !bayOpen ? (
        <button className="btn btn-cream self-end text-base" onClick={() => setBayOpen(true)}>
          🧠 Brain Bay{state.design.tools.length > 0 ? ` (${state.design.tools.length} installed)` : ""}
        </button>
      ) : null}
      {hasBay && bayOpen ? <BrainBay state={state} dispatch={dispatch} onClose={() => setBayOpen(false)} /> : null}

      {state.phase === "report" ? <ReportPanel state={state} dispatch={dispatch} /> : null}
      {state.phase === "bet" ? <BetPanel state={state} dispatch={dispatch} /> : null}
      {state.phase === "night" ? (
        <NightPanel key={state.outcomes.length} state={state} dispatch={dispatch} />
      ) : null}
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
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 pt-4">
        <Link href="/" className="whitespace-nowrap font-display text-xl font-extrabold text-sun sm:text-2xl">
          ☀️ SolCast
        </Link>
        <div className="flex gap-2">
          {state ? (
            <button className="btn btn-cream min-h-12 whitespace-nowrap px-3 text-base" onClick={() => dispatch({ type: "menu" })}>
              Missions
            </button>
          ) : null}
          <Link href="/how-it-works" className="btn btn-cream min-h-12 whitespace-nowrap px-3 text-base">
            Rules
          </Link>
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4">
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
