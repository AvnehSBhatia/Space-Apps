"use client";

/**
 * A night thermometer. Shows the coldest night the battery can cover, the forecast range,
 * and (after the reveal) the real measured low. Display only: all numbers come in as props.
 */

const TOP_C = -30;
const BOTTOM_C = -100;

const toPct = (c: number) => {
  const clamped = Math.max(BOTTOM_C, Math.min(TOP_C, c));
  return ((clamped - BOTTOM_C) / (TOP_C - BOTTOM_C)) * 100;
};

export function Thermometer({
  coveredDownToC,
  forecast,
  actualC,
  height = 220,
}: {
  coveredDownToC?: number | null;
  forecast?: { low: number; high: number } | null;
  actualC?: number | null;
  height?: number;
}) {
  const covered = coveredDownToC == null ? null : toPct(coveredDownToC);
  const fill = actualC == null ? 100 : toPct(actualC);
  const safe = actualC == null || coveredDownToC == null ? true : actualC >= coveredDownToC;
  const ticks = [-40, -60, -80, -100];

  return (
    <div className="flex min-w-[13.5rem] items-stretch gap-3" style={{ height }}>
      <div className="relative w-10">
        {/* tube */}
        <div className="absolute inset-x-1 bottom-8 top-0 overflow-hidden rounded-t-full border-[3px] border-ink bg-white">
          {/* covered zone: everything warmer than coveredDownToC is safe */}
          {covered != null ? <div className="absolute inset-x-0 top-0 bg-mint/35" style={{ height: `${100 - covered}%` }} /> : null}
          {forecast ? (
            <div
              className="absolute inset-x-0 border-y-2 border-dashed border-ink bg-sun/70"
              style={{ bottom: `${toPct(forecast.low)}%`, height: `${Math.max(3, toPct(forecast.high) - toPct(forecast.low))}%` }}
              title="Forecast range"
            />
          ) : null}
          <div
            className="thermo-fill absolute inset-x-2 bottom-0 rounded-t-full"
            style={{ height: `${fill}%`, background: actualC == null ? "#EF476F55" : "#EF476F" }}
          />
        </div>
        {/* bulb */}
        <div className="absolute bottom-0 left-1/2 h-11 w-11 -translate-x-1/2 rounded-full border-[3px] border-ink bg-berry" />
        {/* covered marker */}
        {covered != null ? (
          <div className="absolute -right-1 left-0 border-t-[4px] border-ink" style={{ bottom: `calc(2rem + (100% - 2rem) * ${covered / 100})` }} />
        ) : null}
      </div>
      <div className="relative flex-1 pb-8 text-sm">
        <div className="relative h-full">
          {ticks.map((t) => (
            <span key={t} className="tnum absolute left-0 -translate-y-1/2 text-cream/70" style={{ bottom: `${toPct(t)}%` }}>
              {t} C
            </span>
          ))}
          {covered != null ? (
            <span
              className="absolute left-12 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-ink bg-mint px-2 font-bold text-ink"
              style={{ bottom: `${covered}%` }}
            >
              🔋 safe to {coveredDownToC != null && coveredDownToC < BOTTOM_C ? `below ${BOTTOM_C}` : coveredDownToC} C
            </span>
          ) : null}
          {actualC != null ? (
            <span
              className={`stamp absolute left-12 -translate-y-1/2 whitespace-nowrap rounded-lg border-[3px] border-ink px-2 font-display font-extrabold text-ink ${safe ? "bg-sun" : "bg-berry"}`}
              style={{ bottom: `${toPct(actualC)}%` }}
            >
              Real: {actualC} C
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
