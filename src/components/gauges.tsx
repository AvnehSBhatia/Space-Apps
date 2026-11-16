"use client";

import type { Outpost } from "@/contracts";
import { RULES } from "@/game/rules";
import { kWh } from "./format";
import { Icon, type IconName } from "./icons";
import { Num } from "./rule-cards";

type Level = "good" | "low" | "danger";

function Gauge({
  icon,
  tone,
  label,
  value,
  rule,
  note,
  percent,
  level,
  extra,
}: {
  icon: IconName;
  tone: string;
  label: string;
  value: string;
  rule?: string;
  note: string;
  percent: number;
  level: Level;
  extra?: React.ReactNode;
}) {
  const fill = level === "danger" ? "var(--danger)" : level === "low" ? "var(--sun)" : tone;
  return (
    <div className="card flex flex-col gap-2.5 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Icon name={icon} size={20} style={{ color: tone }} />
        <span className="text-[0.98rem] font-medium">{label}</span>
        <span className="readout w-full text-[1.02rem] sm:ml-auto sm:w-auto">
          {rule ? <Num rule={rule}>{value}</Num> : value}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#33363b]" role="presentation">
        <div className="bar-fill h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: fill }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-[0.92rem] text-ink-2">
        <span>{note}</span>
        {level !== "good" ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${level === "danger" ? "text-danger" : "text-sun"}`}>
            <Icon name="alert" size={15} />
            {level === "danger" ? "Danger" : "Low"}
          </span>
        ) : null}
      </div>
      {extra}
    </div>
  );
}

export function Gauges({ outpost }: { outpost: Outpost }) {
  const batteryPct = (outpost.batteryWh / RULES.BATTERY_CAPACITY_WH) * 100;
  const cropPct = (outpost.cropLightWh / Math.max(1, outpost.cropNeedsWh)) * 100;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Gauge
        icon="heart"
        tone="var(--rust)"
        label="Crew health"
        value={`${Math.round(outpost.crewHealth)}`}
        note="Out of 100"
        percent={outpost.crewHealth}
        level={outpost.crewHealth < 30 ? "danger" : outpost.crewHealth < 60 ? "low" : "good"}
      />
      <Gauge
        icon="bolt"
        tone="var(--battery)"
        label="Battery"
        value={kWh(outpost.batteryWh)}
        rule="keepAlive"
        note="Stored for the night"
        percent={batteryPct}
        level={batteryPct < 15 ? "danger" : batteryPct < 35 ? "low" : "good"}
      />
      <Gauge
        icon="air"
        tone="var(--air)"
        label="Air"
        value={`${Math.round(outpost.airPercent)}%`}
        rule="air"
        note="Breathable air"
        percent={outpost.airPercent}
        level={outpost.airPercent < RULES.AIR_WARNING ? "danger" : outpost.airPercent < 50 ? "low" : "good"}
      />
      <Gauge
        icon="sprout"
        tone="var(--food)"
        label="Food"
        value={`${outpost.meals} meals`}
        note="In the pantry"
        percent={Math.min(100, (outpost.meals / 48) * 100)}
        level={outpost.meals < 4 ? "danger" : outpost.meals < 8 ? "low" : "good"}
        extra={
          <div className="flex items-center gap-2 border-t border-line pt-2.5 text-[0.92rem] text-ink-2">
            <span>Next crop</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#33363b]">
              <div className="bar-fill h-full rounded-full bg-food/70" style={{ width: `${Math.min(100, cropPct)}%` }} />
            </div>
            <Num rule="crop" className="readout text-ink">
              {Math.round(cropPct)}%
            </Num>
          </div>
        }
      />
    </div>
  );
}
