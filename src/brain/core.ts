// Shared pieces every brain file uses. No tool lives here.
// Keep this file free of imports from ./tools or ./index, so a single tool can be compiled and tested alone.

import type { CheckResult, SolReading, Target, ToolInfo, ToolInstance, UvIndex } from "../contracts";

/** A Mars year is about 668 sols. */
export const MARS_YEAR_SOLS = 668;
/** How far back a tool may look for its most recent readings. */
export const LOOK_BACK = 60;

/** The rover's ultraviolet index as a number, so tools can do arithmetic on it. */
export const SUNLIGHT_LEVEL: Record<UvIndex, number> = { Low: 1, Moderate: 2, High: 3, Very_High: 4 };

export type Point = { sol: number; value: number | null };

/** One target's values in sol order. `points[i].value` is null when the rover sent no reading. */
export type Series = { target: Target; points: Point[]; bySol: Map<number, number | null> };

export function toSeries(history: SolReading[], target: Target): Series {
  const points = history.map((reading) => ({
    sol: reading.sol,
    value:
      target === "nightLowC" ? reading.minTempC : reading.uvIndex ? SUNLIGHT_LEVEL[reading.uvIndex] : null,
  }));
  return { target, points, bySol: new Map(points.map((point) => [point.sol, point.value])) };
}

/** The most recent `count` readings before position `end`, newest first. Skips missing readings. */
export function recent(points: Point[], end: number, count: number): number[] {
  const values: number[] = [];
  for (let index = end - 1; index >= 0 && index >= end - LOOK_BACK && values.length < count; index -= 1) {
    const value = points[index].value;
    if (value !== null) values.push(value);
  }
  return values;
}

export const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** A knob's value for one installed tool: the player's setting, clamped to the knob's range, as a whole number. */
export function knobOf(info: ToolInfo, tool: ToolInstance, key: string): number {
  const spec = info.knobs.find((candidate) => candidate.key === key);
  if (!spec) return 0;
  const value = tool.knobs[key];
  const chosen = typeof value === "number" && Number.isFinite(value) ? value : spec.initial;
  return Math.round(Math.min(spec.max, Math.max(spec.min, chosen)));
}

/** What a tool is given when it learns. It may read only positions `from <= p < end`. */
export type FitContext = {
  series: Series;
  from: number;
  end: number;
  tool: ToolInstance;
  /** For anything random, with createRng(seed) from src/lib/rng.ts. Never Math.random. */
  seed: number;
};

/** What a tool is given when it guesses position `end`. It may read only positions before `end`. */
export type GuessContext = {
  series: Series;
  end: number;
  /** The sol being predicted. */
  targetSol: number;
  tool: ToolInstance;
  /** Whatever this tool's fit() returned, after a JSON round trip. null when the tool has no fit(). */
  params: unknown;
};

/**
 * One forecasting tool. Each tool is its own file in src/brain/tools.
 *
 * Rules:
 * - Pure and deterministic. No Math.random, no Date, no network, no module-level state that changes.
 * - fit() and guess() never read a position at or after `end`.
 * - fit() returns plain JSON (numbers, arrays, objects). It is stored in a save file.
 * - guess() returns null only when there is no earlier reading at all. Never NaN or Infinity.
 * - Speed, on a laptop: fit() under 3 ms, guess() under 0.05 ms on average.
 */
export type ToolModule = {
  info: ToolInfo;
  fit?(context: FitContext): unknown;
  guess(context: GuessContext): number | null;
  /** Checks for this tool alone. Shown on /play and run by `npm run check`. */
  checks?(): CheckResult[];
};

/** Collects check results without letting one thrown error hide the rest. */
export function checker() {
  const results: CheckResult[] = [];
  const check = (name: string, run: () => string | true) => {
    try {
      const outcome = run();
      results.push({ name, pass: outcome === true, detail: outcome === true ? "ok" : outcome });
    } catch (error) {
      results.push({ name, pass: false, detail: error instanceof Error ? error.message : "threw" });
    }
  };
  return { results, check };
}

export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
