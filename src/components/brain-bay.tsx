"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { brain } from "@/brain";
import { HIT_WITHIN, scoreboard } from "@/brain/scoreboard";
import type { Action, GameState, TestFlight, ToolId, ToolInfo, ToolInstance } from "@/contracts";
import { kWh } from "./format";
import { Icon, type IconName } from "./icons";

const TOOL_ICON: Record<ToolId, IconName> = {
  copycat: "copy",
  averager: "air",
  season: "book",
  trend: "rocket",
  longMemory: "moon",
  spotlight: "sun",
  neurons: "brain",
};

/** Part A's scoreboard: one mark per recent sol, "right 9 of the last 10". */
function HitRow({ instance, state }: { instance: ToolInstance; state: GameState }) {
  const knobKey = JSON.stringify(instance.knobs);
  const board = useMemo(
    () => scoreboard(instance, state.history, "nightLowC", 10),
    // knobKey stands in for the knobs object so a new object with the same values does not refit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instance.id, knobKey, state.history],
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex gap-[3px]" aria-hidden>
        {board.marks.map((mark) => (
          <span
            key={mark.sol}
            title={mark.hit === null ? `Sol ${mark.sol}: no reading` : `Sol ${mark.sol}: ${mark.hit ? "close" : "missed"}`}
            className="h-2.5 w-3 rounded-[2px]"
            style={{ background: mark.hit === null ? "#2e3035" : mark.hit ? "var(--air)" : "#55585e" }}
          />
        ))}
      </div>
      <span className="text-[13px] text-ink-2">
        Right <span className="readout text-ink">{board.hits}</span> of the last {board.played} nights
      </span>
    </div>
  );
}

export function BrainBay({ state, dispatch, onClose }: { state: GameState; dispatch: Dispatch<Action>; onClose: () => void }) {
  const [flight, setFlight] = useState<{ key: string; result: TestFlight } | null>(null);
  const tools = brain.catalog().filter((tool) => state.availableTools.includes(tool.id));
  const byId = new Map(state.design.tools.map((tool) => [tool.id, tool]));
  const canChange = state.phase === "report" || state.phase === "bet";
  const designKey = JSON.stringify(state.design.tools) + `@${state.todaySol}`;
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
    const next = byId.has(tool.id)
      ? state.design.tools.filter((t) => t.id !== tool.id)
      : [...state.design.tools, { uid: tool.id, id: tool.id, knobs: {} }];
    dispatch({ type: "setDesign", design: { tools: next } });
  };

  const setKnob = (id: ToolId, key: string, value: number) => {
    const next = state.design.tools.map((t) => (t.id === id ? { ...t, knobs: { ...t.knobs, [key]: value } } : t));
    dispatch({ type: "setDesign", design: { tools: next } });
  };

  const r = (n: number) => n.toFixed(1);
  const core = tools.filter((tool) => !tool.advanced);
  const lab = tools.filter((tool) => tool.advanced);

  const renderTool = (tool: ToolInfo) => {
    const installed = byId.get(tool.id);
    const instance: ToolInstance = installed ?? { uid: tool.id, id: tool.id, knobs: {} };
    return (
      <li key={tool.id} className={`rounded-[12px] border p-4 ${installed ? "border-dusk/50 bg-dusk-soft" : "border-line bg-card"}`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-line bg-haze text-ink">
            <Icon name={TOOL_ICON[tool.id]} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-xl">{tool.name}</p>
              <p className="text-[13px] text-ink-2">{tool.realName}</p>
            </div>
            <p className="mt-1 text-[0.95rem] text-ink-2">{tool.blurb}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="readout inline-flex items-center gap-1 text-[13px] text-ink-2">
              <Icon name="bolt" size={13} className="text-dusk" />
              {tool.energyWhPerSol < 1000 ? `${tool.energyWhPerSol} Wh` : kWh(tool.energyWhPerSol)}
            </span>
            <button
              className={`btn min-h-11 min-w-28 text-[0.98rem] ${installed ? "btn-quiet" : "btn-primary"}`}
              disabled={!tool.ready || !canChange}
              onClick={() => toggle(tool)}
              aria-pressed={Boolean(installed)}
            >
              {!tool.ready ? "Coming soon" : installed ? "Remove" : "Install"}
            </button>
          </div>
        </div>
        {tool.ready ? (
          <div className="mt-3 border-t border-line pt-3">
            <HitRow instance={instance} state={state} />
          </div>
        ) : null}
        {installed && tool.knobs.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
            {tool.knobs.map((knob) => {
              const value = installed.knobs[knob.key] ?? knob.initial;
              const fill = ((value - knob.min) / Math.max(1, knob.max - knob.min)) * 100;
              return (
                <label key={knob.key} className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between text-[0.95rem]">
                    <span className="text-ink-2">{knob.label}</span>
                    <span className="readout">{value}</span>
                  </span>
                  <input
                    type="range"
                    className="slider"
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    value={value}
                    disabled={!canChange}
                    style={{ ["--fill" as string]: `${fill}%` }}
                    onChange={(event) => setKnob(tool.id, knob.key, Number(event.target.value))}
                  />
                </label>
              );
            })}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bay-title">
      <button className="absolute inset-0 cursor-default bg-black/60" aria-label="Close Brain Bay" onClick={onClose} />
      <aside className="reveal relative flex h-full w-full max-w-xl flex-col gap-5 overflow-y-auto border-l border-line bg-haze p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <Icon name="brain" size={28} className="mt-1 text-dusk" />
          <div className="flex-1">
            <h2 id="bay-title" className="text-[2rem]">
              Brain Bay
            </h2>
            <p className="text-ink-2">Install forecasting tools for the outpost computer. Each one uses a little power.</p>
          </div>
          <button ref={closeRef} className="btn btn-quiet h-11 min-h-0 w-11 p-0" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {!canChange ? <p className="rounded-[10px] bg-sun-soft px-3 py-2 text-[0.95rem]">You can change tools in the morning.</p> : null}

        <ul className="flex flex-col gap-3">{core.map(renderTool)}</ul>
        {lab.length > 0 ? (
          <>
            <p className="-mb-2 mt-2 text-[13px] font-medium text-ink-2">Advanced lab</p>
            <ul className="flex flex-col gap-3">{lab.map(renderTool)}</ul>
          </>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
          <button
            className="btn btn-primary w-full text-lg"
            onClick={() =>
              setFlight({ key: designKey, result: brain.testFlight(state.design, state.history, "nightLowC", 30, state.seed) })
            }
          >
            <Icon name="rocket" size={18} /> Run test flight
          </button>
          {current ? (
            <div className="rounded-[10px] border border-line bg-card p-4">
              <p className="text-[13px] text-ink-2">Test flight on the last 30 sols{state.design.tools.length === 0 ? ", Copycat only" : ""}</p>
              <div className="mt-2">
                <div className="leader py-1">
                  <span className="text-ink-2">Your brain is off by</span>
                  <span className="readout">
                    {r(current.averageMiss)} C <span className="text-ink-2">± {r(current.missNoise)}</span>
                  </span>
                </div>
                <div className="leader py-1">
                  <span className="text-ink-2">Copycat alone is off by</span>
                  <span className="readout">{r(current.copycatMiss)} C</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[0.95rem] text-ink-2">
              A test flight tries your tools on the last 30 sols. A green mark is a night the tool guessed within{" "}
              {HIT_WITHIN.nightLowC} C.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
