"use client";

import type { Outpost } from "@/contracts";
import { RULES } from "@/game/rules";
import { kWh } from "./format";
import { Num } from "./rule-cards";

type Level = "good" | "low" | "danger";

const LEVEL_STYLE: Record<Level, { word: string; icon: string; chip: string }> = {
  good: { word: "OK", icon: "✓", chip: "bg-mint" },
  low: { word: "Low", icon: "!", chip: "bg-sun" },
  danger: { word: "Danger", icon: "!!", chip: "bg-berry" },
};

function Bar({ percent, colour }: { percent: number; colour: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-5 overflow-hidden rounded-full border-[3px] border-ink bg-white">
      <div className="gauge-fill h-full rounded-full" style={{ width: `${p}%`, background: colour }} />
    </div>
  );
}

function Gauge({
  icon,
  label,
  value,
  rule,
  percent,
  colour,
  level,
  extra,
}: {
  icon: string;
  label: string;
  value: string;
  rule?: string;
  percent: number;
  colour: string;
  level: Level;
  extra?: React.ReactNode;
}) {
  const style = LEVEL_STYLE[level];
  return (
    <div className="chunk flex flex-col gap-1.5 bg-cream px-3 py-2 text-ink">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-extrabold leading-none">
          <span aria-hidden>{icon}</span> {label}
        </span>
        <span className={`${style.chip} rounded-full border-2 border-ink px-2 text-xs font-bold`}>
          <span aria-hidden>{style.icon} </span>
          {style.word}
        </span>
      </div>
      <Bar percent={percent} colour={colour} />
      <div className="text-base">
        {rule ? <Num rule={rule}>{value}</Num> : <span className="tnum">{value}</span>}
        {extra}
      </div>
    </div>
  );
}

export function Gauges({ outpost }: { outpost: Outpost }) {
  const batteryPct = (outpost.batteryWh / RULES.BATTERY_CAPACITY_WH) * 100;
  const cropPct = (outpost.cropLightWh / Math.max(1, outpost.cropNeedsWh)) * 100;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Gauge
        icon="❤️"
        label="Crew"
        value={`${Math.round(outpost.crewHealth)} of 100`}
        percent={outpost.crewHealth}
        colour="#EF476F"
        level={outpost.crewHealth < 30 ? "danger" : outpost.crewHealth < 60 ? "low" : "good"}
      />
      <Gauge
        icon="🔋"
        label="Battery"
        value={kWh(outpost.batteryWh)}
        rule="keepAlive"
        percent={batteryPct}
        colour="#4CC9F0"
        level={batteryPct < 15 ? "danger" : batteryPct < 35 ? "low" : "good"}
      />
      <Gauge
        icon="💨"
        label="Air"
        value={`${Math.round(outpost.airPercent)}%`}
        rule="air"
        percent={outpost.airPercent}
        colour="#3DDC97"
        level={outpost.airPercent < RULES.AIR_WARNING ? "danger" : outpost.airPercent < 50 ? "low" : "good"}
      />
      <Gauge
        icon="🥕"
        label="Food"
        value={`${outpost.meals} meals`}
        percent={Math.min(100, (outpost.meals / 48) * 100)}
        colour="#FF7A3D"
        level={outpost.meals < 4 ? "danger" : outpost.meals < 8 ? "low" : "good"}
        extra={
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span aria-hidden>🌱</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
              <div className="gauge-fill h-full bg-leaf" style={{ width: `${Math.min(100, cropPct)}%` }} />
            </div>
            <Num rule="crop">crop {Math.round(cropPct)}%</Num>
          </div>
        }
      />
    </div>
  );
}
