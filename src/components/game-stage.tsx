"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GameState, Outpost, UvIndex } from "@/contracts";
import { RULES } from "@/game/rules";
import { Confetti, CrewStatus, moodOf } from "./crew";
import { SUNLIGHT_WORD, kWh, niceDate } from "./format";
import { Icon, type IconName } from "./icons";
import { MarsScene } from "./mars-scene";
import { Num } from "./rule-cards";

// The 3D outpost is loaded only in the browser, and only when it can be shown.
const Outpost3D = dynamic(() => import("./outpost-3d").then((m) => m.Outpost3D), { ssr: false, loading: () => null });

let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      webglSupport = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
/** True when the browser can draw the 3D scene and the player has not asked for less motion. */
const canShow3D = () => !window.matchMedia(REDUCED_MOTION).matches && hasWebGL();
const canShow3DOnServer = () => false;

/** If the 3D scene fails to load or crashes, show nothing here: the flat scene stays underneath. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const CELLS = 12;
const LIGHT_LEVEL: Record<UvIndex, number> = { Low: 1, Moderate: 2, High: 3, Very_High: 4 };

type Level = "good" | "low" | "danger";

function Meter({
  icon,
  label,
  value,
  rule,
  percent,
  tone,
  level,
  sub,
}: {
  icon: IconName;
  label: string;
  value: string;
  rule?: string;
  percent: number;
  tone: string;
  level: Level;
  sub?: React.ReactNode;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * CELLS);
  const colour = level === "danger" ? "var(--danger)" : level === "low" ? "var(--sun)" : tone;
  return (
    <div className="flex min-w-0 flex-col gap-2 px-3.5 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon name={icon} size={17} style={{ color: tone }} className="flex-none" />
        <span className="truncate text-[0.92rem] text-ink-2">{label}</span>
        {level !== "good" ? (
          <span className={`ml-1 inline-flex items-center gap-1 text-[13px] font-medium ${level === "danger" ? "text-danger" : "text-sun"}`}>
            <Icon name="alert" size={13} />
            {level === "danger" ? "Danger" : "Low"}
          </span>
        ) : null}
        <span className="readout w-full text-[1rem] text-ink sm:ml-auto sm:w-auto">{rule ? <Num rule={rule}>{value}</Num> : value}</span>
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: CELLS }, (_, i) => (
          <span key={i} className="cell" style={i < filled ? { background: colour } : undefined} />
        ))}
      </div>
      {sub}
    </div>
  );
}

export function Meters({ outpost, className = "" }: { outpost: Outpost; className?: string }) {
  const batteryPct = (outpost.batteryWh / RULES.BATTERY_CAPACITY_WH) * 100;
  const cropPct = (outpost.cropLightWh / Math.max(1, outpost.cropNeedsWh)) * 100;
  return (
    <div className={`grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x ${className}`} aria-label="Outpost status">
      <Meter
        icon="heart"
        label="Crew health"
        value={`${Math.round(outpost.crewHealth)}`}
        percent={outpost.crewHealth}
        tone="var(--dusk)"
        level={outpost.crewHealth < 30 ? "danger" : outpost.crewHealth < 60 ? "low" : "good"}
      />
      <Meter
        icon="bolt"
        label="Battery"
        value={kWh(outpost.batteryWh)}
        rule="keepAlive"
        percent={batteryPct}
        tone="var(--battery)"
        level={batteryPct < 15 ? "danger" : batteryPct < 35 ? "low" : "good"}
      />
      <Meter
        icon="air"
        label="Air"
        value={`${Math.round(outpost.airPercent)}%`}
        rule="air"
        percent={outpost.airPercent}
        tone="var(--air)"
        level={outpost.airPercent < RULES.AIR_WARNING ? "danger" : outpost.airPercent < 50 ? "low" : "good"}
      />
      <Meter
        icon="sprout"
        label="Food"
        value={`${outpost.meals} meals`}
        percent={Math.min(100, (outpost.meals / 48) * 100)}
        tone="var(--food)"
        level={outpost.meals < 4 ? "danger" : outpost.meals < 8 ? "low" : "good"}
        sub={
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <span>Next crop</span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#2e3035]">
              <span className="bar-fill block h-full bg-food/70" style={{ width: `${Math.min(100, cropPct)}%` }} />
            </span>
            <Num rule="crop" className="readout text-ink">
              {Math.round(cropPct)}%
            </Num>
          </div>
        }
      />
    </div>
  );
}

function SunGauge({ sunlight }: { sunlight: UvIndex }) {
  const level = LIGHT_LEVEL[sunlight];
  return (
    <div className="hud flex items-center gap-3 px-3.5 py-2.5">
      <Icon name="sun" size={18} className="text-sun" />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] leading-none text-ink-2">
          Sunlight <Num rule="sunlight" className="font-medium text-ink">{SUNLIGHT_WORD[sunlight]}</Num>
        </span>
        <span className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="h-1.5 w-6 rounded-[2px]" style={{ background: i <= level ? "var(--sun)" : "#3a3c41" }} />
          ))}
        </span>
      </div>
    </div>
  );
}

/** The play area: Gale Crater with the heads-up display laid over it. */
export function GameStage({ state }: { state: GameState }) {
  const night = state.phase === "night";
  const lost = state.ending === "crewLost";
  const mood = moodOf(state);
  const sol = String(state.solIndex + 1).padStart(2, "0");
  const title = night ? "The outpost at night in Gale Crater" : `The outpost in Gale Crater, sunlight ${SUNLIGHT_WORD[state.sunlight]}`;

  // The flat scene shows first and stays as the fallback: no WebGL, reduced motion, or a 3D failure.
  const supported = useSyncExternalStore(subscribeMotion, canShow3D, canShow3DOnServer);
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const [failed, setFailed] = useState(false);
  const show3D = supported && !failed;
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setSettled(true), 900);
    return () => window.clearTimeout(id);
  }, [ready]);

  return (
    <div className="relative overflow-hidden rounded-t-[16px] border border-b-0 border-line bg-deep">
      <div className="relative h-[280px] sm:h-[340px] lg:h-[clamp(340px,46vh,460px)]">
        {show3D && settled ? (
          <span className="sr-only">{title}</span>
        ) : (
          <MarsScene weather={night ? "night" : state.sunlight} className="absolute inset-0 h-full w-full" title={title} />
        )}
        {show3D ? (
          <SceneBoundary onError={onFail}>
            <Outpost3D
              state={state}
              className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
              onReady={onReady}
              onLost={onFail}
            />
          </SceneBoundary>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" aria-hidden />

        <div className="absolute left-3 top-3 sm:left-5 sm:top-5">
          <div className="hud px-4 py-2.5">
            <p className="text-[13px] leading-none text-ink-2">{state.mission.title}</p>
            <p className="readout mt-1.5 text-[1.9rem] leading-none text-ink sm:text-[2.3rem]">
              <Num rule="mars-day">Sol</Num> {sol}
              <span className="text-ink-2">/{state.mission.lengthSols}</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-none text-ink-2">{niceDate(state.todayEarthDate)}</p>
          </div>
        </div>

        <div className="absolute right-3 top-3 sm:right-5 sm:top-5">
          {night ? (
            <div className="hud flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-ink-2">
              <Icon name="moon" size={18} className="text-ink" /> Night
            </div>
          ) : (
            <SunGauge sunlight={state.sunlight} />
          )}
        </div>

        <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5">
          {lost ? (
            <span className="hud inline-flex items-center gap-2 px-3.5 py-2 text-[0.95rem]">
              <Icon name="rocket" size={17} className="text-dusk" /> The crew was flown home safely.
            </span>
          ) : (
            <CrewStatus mood={mood} />
          )}
        </div>

        {mood === "harvest" ? <Confetti /> : null}
      </div>
      <div className="border-t border-line bg-[#1c1d20]">
        <Meters
          outpost={state.outpost}
          className="[&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-line [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-line lg:[&>*]:border-b-0 lg:[&>*:nth-child(odd)]:border-r-0"
        />
      </div>
    </div>
  );
}
