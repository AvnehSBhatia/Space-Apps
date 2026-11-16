"use client";

/**
 * Tonight's temperature scale. Shows the coldest night the battery can cover, the forecast range,
 * and (after the reveal) the real measured low. Display only: every number comes in as a prop.
 */

const TOP_C = -40;
const BOTTOM_C = -100;
const TICKS = [-40, -50, -60, -70, -80, -90, -100];

const pct = (c: number) => ((Math.max(BOTTOM_C, Math.min(TOP_C, c)) - BOTTOM_C) / (TOP_C - BOTTOM_C)) * 100;

export function Thermometer({
  coveredDownToC,
  forecast,
  actualC,
  dark = false,
  height = 300,
}: {
  coveredDownToC?: number | null;
  forecast?: { low: number; high: number } | null;
  actualC?: number | null;
  dark?: boolean;
  height?: number;
}) {
  const covered = coveredDownToC == null ? null : pct(coveredDownToC);
  const offScale = coveredDownToC != null && coveredDownToC < BOTTOM_C;
  const safe = actualC == null || coveredDownToC == null || actualC >= coveredDownToC;
  const muted = dark ? "text-white/65" : "text-ink-2";
  const axis = dark ? "bg-white/35" : "bg-[#9AA4BF]";
  const label =
    actualC != null
      ? `Real low ${actualC} C`
      : `Forecast ${forecast ? `${Math.round(forecast.high)} to ${Math.round(forecast.low)} C` : "unknown"}${
          coveredDownToC != null ? `, battery safe to ${coveredDownToC} C` : ""
        }`;

  return (
    <div className="relative grid grid-cols-[3.6rem_1fr] gap-2 py-3" style={{ height }} role="img" aria-label={label}>
      <div className="relative">
        {TICKS.map((t) => (
          <span key={t} className={`tnum absolute right-0 -translate-y-1/2 text-[0.9rem] ${muted}`} style={{ bottom: `${pct(t)}%` }}>
            {t} C
          </span>
        ))}
      </div>
      <div className="relative">
        <div className={`absolute bottom-0 left-2 top-0 w-0.5 rounded ${axis}`} />
        {TICKS.map((t) => (
          <div key={t} className={`absolute left-0 h-0.5 w-[18px] ${axis}`} style={{ bottom: `${pct(t)}%` }} />
        ))}

        {forecast ? (
          <>
            <div
              className="absolute left-6 w-12 rounded-lg bg-sun/45 ring-1 ring-sun"
              style={{ bottom: `${pct(forecast.low)}%`, height: `${Math.max(3, pct(forecast.high) - pct(forecast.low))}%` }}
            />
            <div
              className={`absolute left-[5.4rem] -translate-y-1/2 text-[0.92rem] leading-tight ${dark ? "text-white" : "text-ink"}`}
              style={{ bottom: `${Math.min(92, Math.max(8, (pct(forecast.low) + pct(forecast.high)) / 2))}%` }}
            >
              <span className="font-semibold">Forecast</span>
              <br />
              <span className={`tnum ${muted}`}>
                {Math.round(forecast.high)} to {Math.round(forecast.low)} C
              </span>
            </div>
          </>
        ) : null}

        {actualC != null ? (
          <>
            <div
              className="thermo-fill absolute bottom-0 left-[3px] w-3 rounded-full"
              style={{ height: `${pct(actualC)}%`, background: safe ? "var(--sun)" : "var(--danger)" }}
            />
            <span
              className="real-tag tnum absolute left-8 -translate-y-1/2 rounded-lg px-2.5 py-1 font-display text-lg font-bold text-ink"
              style={{ bottom: `${pct(actualC)}%`, background: safe ? "var(--sun)" : "var(--danger)" }}
            >
              {actualC} C
            </span>
          </>
        ) : null}

        {covered != null ? (
          <>
            <div className="absolute left-0.5 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-air ring-2 ring-white" style={{ bottom: `${covered}%` }} />
            <div
              className="absolute left-5 right-[8.5rem] -translate-y-1/2 border-t-2 border-dashed border-air"
              style={{ bottom: `${covered}%` }}
            />
            <span
              className="tnum absolute right-0 -translate-y-1/2 whitespace-nowrap rounded-lg bg-air-soft px-2.5 py-1 text-[0.95rem] font-semibold text-[#0E7A5F]"
              style={{ bottom: `${covered}%` }}
            >
              Safe to {offScale ? `below ${BOTTOM_C}` : coveredDownToC} C
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
