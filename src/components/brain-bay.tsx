"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { brain } from "@/brain";
import type { Action, GameState, TestFlight, ToolId, ToolInfo } from "@/contracts";
import { kWh } from "./format";
import { Icon, type IconName } from "./icons";

const HIT_WITHIN_C = 2;
const TOOL_ICON: Partial<Record<ToolId, IconName>> = { copycat: "copy", averager: "air", season: "book", trend: "rocket" };

function HitDots({ tool, state }: { tool: ToolInfo; state: GameState }) {
  const points = useMemo(
    () => brain.preview({ uid: tool.id, id: tool.id, knobs: {} }, state.history, "nightLowC", 10),
    [tool.id, state.history],
  );
  const hits = points.filter((p) => p.actual != null && p.guess != null && Math.abs(p.guess - p.actual) <= HIT_WITHIN_C).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {points.map((p) => {
          const known = p.actual != null && p.guess != null;
          const hit = known && Math.abs((p.guess as number) - (p.actual as number)) <= HIT_WITHIN_C;
          return (
            <span
              key={p.sol}
              title={known ? `Sol ${p.sol}: guessed ${p.guess} C, real ${p.actual} C` : `Sol ${p.sol}: no data`}
              className={`h-2.5 w-2.5 rounded-full ${!known ? "bg-[#E1E5EE]" : hit ? "bg-air" : "bg-[#C4CAD8]"}`}
            />
          );
        })}
      </div>
      <span className="text-sm text-ink-2">
        {hits} of {points.length} close
      </span>
    </div>
  );
}

export function BrainBay({ state, dispatch, onClose }: { state: GameState; dispatch: Dispatch<Action>; onClose: () => void }) {
  const [flight, setFlight] = useState<{ key: string; result: TestFlight } | null>(null);
  const tools = brain.catalog().filter((tool) => state.availableTools.includes(tool.id));
  const installed = new Set(state.design.tools.map((tool) => tool.id));
  const canChange = state.phase === "report" || state.phase === "bet";
  const designKey = state.design.tools.map((tool) => tool.id).join(",") + `@${state.todaySol}`;
  const current = flight && flight.key === designKey ? flight.result : null;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (tool: ToolInfo) => {
    const next = installed.has(tool.id)
      ? state.design.tools.filter((t) => t.id !== tool.id)
      : [...state.design.tools, { uid: tool.id, id: tool.id, knobs: {} }];
    dispatch({ type: "setDesign", design: { tools: next } });
  };
  const r = (n: number) => n.toFixed(1);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bay-title">
      <button className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px]" aria-label="Close Brain Bay" onClick={onClose} />
      <aside className="reveal relative flex h-full w-full max-w-xl flex-col gap-5 overflow-y-auto bg-haze p-5 shadow-2xl sm:rounded-l-[28px] sm:p-7">
        <div className="flex items-start gap-3">
          <Icon name="brain" size={34} className="mt-1 text-dusk" />
          <div className="flex-1">
            <h2 id="bay-title" className="text-3xl font-bold">
              Brain Bay
            </h2>
            <p className="text-ink-2">Install forecasting tools. Each uses a little power.</p>
          </div>
          <button ref={closeRef} className="btn btn-quiet h-12 min-h-0 w-12 p-0" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        {!canChange ? <p className="rounded-xl bg-sun-soft px-3 py-2 text-[0.95rem]">You can change tools in the morning.</p> : null}

        <ul className="flex flex-col gap-3">
          {tools.map((tool) => {
            const on = installed.has(tool.id);
            return (
              <li key={tool.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-haze text-ink">
                  <Icon name={TOOL_ICON[tool.id] ?? "cpu"} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-bold">{tool.name}</p>
                    <span className="tnum inline-flex items-center gap-1 rounded-full bg-dusk-soft px-2 py-0.5 text-sm font-semibold text-dusk">
                      <Icon name="bolt" size={14} />
                      {tool.energyWhPerSol < 1000 ? `${tool.energyWhPerSol} Wh` : kWh(tool.energyWhPerSol)}
                    </span>
                  </div>
                  <p className="text-sm text-ink-2">{tool.realName}</p>
                  <p className="mt-1 text-[0.95rem]">{tool.blurb}</p>
                  {tool.ready ? (
                    <div className="mt-2">
                      <HitDots tool={tool} state={state} />
                    </div>
                  ) : null}
                </div>
                <button
                  className={`btn min-w-28 ${on ? "btn-quiet" : "btn-primary"}`}
                  disabled={!tool.ready || !canChange}
                  onClick={() => toggle(tool)}
                  aria-pressed={on}
                >
                  {!tool.ready ? "Coming soon" : on ? "Remove" : "Install"}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto flex flex-col gap-3">
          <button
            className="btn btn-primary w-full text-lg"
            onClick={() =>
              setFlight({ key: designKey, result: brain.testFlight(state.design, state.history, "nightLowC", 30, state.seed) })
            }
          >
            <Icon name="rocket" size={20} /> Run test flight
          </button>
          {current ? (
            <p className="rounded-2xl bg-dusk-soft px-4 py-3">
              {state.design.tools.length === 0 ? "No tools yet, so this is Copycat. " : ""}
              Off by {r(current.averageMiss)} C, give or take {r(current.missNoise)}. Copycat alone: {r(current.copycatMiss)} C.
            </p>
          ) : (
            <p className="text-[0.95rem] text-ink-2">
              A test flight tries your tools on the last 30 sols. Green dots are nights a tool guessed within {HIT_WITHIN_C} C.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
