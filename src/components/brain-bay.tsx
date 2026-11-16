"use client";

import { useMemo, useState, type Dispatch } from "react";
import { brain } from "@/brain";
import type { Action, GameState, TestFlight, ToolInfo } from "@/contracts";
import { kWh } from "./format";

const HIT_WITHIN_C = 2;

function HitRow({ tool, state }: { tool: ToolInfo; state: GameState }) {
  const points = useMemo(
    () => brain.preview({ uid: tool.id, id: tool.id, knobs: {} }, state.history, "nightLowC", 10),
    [tool.id, state.history],
  );
  return (
    <div className="flex items-center gap-1" aria-label={`Last ${points.length} sols: guesses within ${HIT_WITHIN_C} C`}>
      {points.map((point) => {
        const known = point.actual != null && point.guess != null;
        const hit = known && Math.abs((point.guess as number) - (point.actual as number)) <= HIT_WITHIN_C;
        return (
          <span
            key={point.sol}
            title={known ? `Sol ${point.sol}: guessed ${point.guess} C, real ${point.actual} C` : `Sol ${point.sol}: no data`}
            className={`grid h-6 w-6 place-items-center rounded-md border-2 border-ink text-xs font-bold ${
              !known ? "bg-white/60" : hit ? "bg-mint" : "bg-berry text-cream"
            }`}
          >
            {!known ? "–" : hit ? "✓" : "✗"}
          </span>
        );
      })}
    </div>
  );
}

function flightLine(flight: TestFlight) {
  const r = (n: number) => n.toFixed(1);
  return `Off by ${r(flight.averageMiss)} C, give or take ${r(flight.missNoise)}. Copycat alone: ${r(flight.copycatMiss)} C.`;
}

export function BrainBay({ state, dispatch, onClose }: { state: GameState; dispatch: Dispatch<Action>; onClose: () => void }) {
  const [flight, setFlight] = useState<{ key: string; result: TestFlight } | null>(null);
  const tools = brain.catalog().filter((tool) => state.availableTools.includes(tool.id));
  const installed = new Set(state.design.tools.map((tool) => tool.id));
  const canChange = state.phase === "report" || state.phase === "bet";
  const designKey = state.design.tools.map((tool) => tool.id).join(",") + `@${state.todaySol}`;
  const currentFlight = flight && flight.key === designKey ? flight.result : null;

  const toggle = (tool: ToolInfo) => {
    const next = installed.has(tool.id)
      ? state.design.tools.filter((t) => t.id !== tool.id)
      : [...state.design.tools, { uid: tool.id, id: tool.id, knobs: {} }];
    dispatch({ type: "setDesign", design: { tools: next } });
  };

  return (
    <section className="chunk pop-in flex flex-col gap-4 bg-[#E7F7FF] p-4 text-ink sm:p-6" aria-labelledby="bay-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="bay-title" className="font-display text-2xl font-extrabold">
            🧠 Brain Bay
          </h2>
          <p className="text-base">Install tools to make your own forecast. Each one uses a little power.</p>
        </div>
        <button className="btn btn-cream min-h-12 px-4 text-base" onClick={onClose}>
          Close
        </button>
      </div>
      {!canChange ? <p className="rounded-2xl bg-sun/50 p-2 text-base">You can change tools in the morning.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => {
          const on = installed.has(tool.id);
          return (
            <div key={tool.id} className={`rounded-3xl border-[3px] border-ink p-3 ${on ? "bg-mint/40" : "bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-extrabold leading-tight">{tool.name}</p>
                  <p className="text-sm text-ink/70">{tool.realName}</p>
                </div>
                <span className="tnum whitespace-nowrap rounded-full border-2 border-ink bg-blue/40 px-2 text-sm font-bold">
                  ⚡ {tool.energyWhPerSol < 1000 ? `${tool.energyWhPerSol} Wh` : kWh(tool.energyWhPerSol)}
                </span>
              </div>
              <p className="my-2 text-base">{tool.blurb}</p>
              {tool.ready ? <HitRow tool={tool} state={state} /> : null}
              <button
                className={`btn mt-3 w-full text-base ${on ? "btn-sun" : "btn-cream"}`}
                disabled={!tool.ready || !canChange}
                onClick={() => toggle(tool)}
                aria-pressed={on}
              >
                {!tool.ready ? "🔒 Coming soon" : on ? "✓ Installed: remove" : "Install"}
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="btn btn-mint w-full"
        onClick={() =>
          setFlight({ key: designKey, result: brain.testFlight(state.design, state.history, "nightLowC", 30, state.seed) })
        }
      >
        🚀 Test flight on the last 30 sols
      </button>
      {currentFlight ? (
        <p className="rounded-2xl border-[3px] border-ink bg-white p-3 font-bold">
          {state.design.tools.length === 0 ? "No tools yet, so this is Copycat. " : ""}
          {flightLine(currentFlight)}
        </p>
      ) : null}
      <p className="text-sm text-ink/70">
        Green ✓ means the tool guessed the night within {HIT_WITHIN_C} C on that sol. Test a forecast before you trust it.
      </p>
    </section>
  );
}
