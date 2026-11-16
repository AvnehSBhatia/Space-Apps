// Shared pieces every brain file uses. No tool lives here.
// Keep this file free of imports from ./tools or ./index, so a single tool can be compiled and tested alone.

import type { CheckResult, SolReading, Target, ToolId, ToolInfo, ToolInstance, UvIndex } from "../contracts";

/** A Mars year is about 668 sols. */
export const MARS_YEAR_SOLS = 668;
/** How many recent sols the brain learns from. Tools that keep a long memory look back this far too. */
export const TRAIN_WINDOW = 160;
/** A test flight learns again this often instead of every sol, which keeps it fast. */
export const RELEARN_EVERY = 10;
/** How far back recent() looks. */
export const LOOK_BACK = 60;

/** The rover's ultraviolet index as a number, so tools can do arithmetic on it. */
export const SUNLIGHT_LEVEL: Record<UvIndex, number> = { Low: 1, Moderate: 2, High: 3, Very_High: 4 };

export type Point = { sol: number; value: number | null };

/** One target's values in sol order. `points[i].value` is null when the rover sent no reading. */
export type Series = { target: Target; points: Point[]; bySol: Map<number, number | null> };

/** No Mars reading comes near this. A bigger one is broken and counts as missing, so no sum can overflow. */
const BROKEN_READING = 1e6;

/** True for a real number: not NaN, not Infinity, and not a number written as text. */
export const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function seriesOf(target: Target, points: Point[]): Series {
  return { target, points, bySol: new Map(points.map((point) => [point.sol, point.value])) };
}

export function toSeries(history: SolReading[], target: Target): Series {
  const points = history.map((reading) => {
    const raw: unknown =
      target === "nightLowC" ? reading.minTempC : reading.uvIndex ? SUNLIGHT_LEVEL[reading.uvIndex] : null;
    return { sol: reading.sol, value: isNumber(raw) && Math.abs(raw) < BROKEN_READING ? raw : null };
  });
  return seriesOf(target, points);
}

/** A made-up night-low series for a tool's own checks: one value per sol, starting at sol 1. */
export function madeUpSeries(values: (number | null)[]): Series {
  return seriesOf(
    "nightLowC",
    values.map((value, index) => ({ sol: index + 1, value })),
  );
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

/** Every reading at positions `from <= p < end`, oldest first. Skips missing readings. */
export function readings(points: Point[], from: number, end: number): number[] {
  const values: number[] = [];
  for (let index = Math.max(0, from); index < Math.min(end, points.length); index += 1) {
    const value = points[index].value;
    if (value !== null) values.push(value);
  }
  return values;
}

export const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Keeps a guess from running further past the readings than they are spread out. */
export function withinReach(values: number[], guess: number): number {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return Math.min(high + (high - low), Math.max(low - (high - low), guess));
}

export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** A copy that has been through JSON, as a save file stores it. Everything a tool learns is kept this way. */
export function plain(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

/** A tool installed with every knob left at its initial value. */
export const installed = (id: ToolId, uid: string = id): ToolInstance => ({ uid, id, knobs: {} });

/** A knob's value for one installed tool: the player's setting, clamped to the knob's range, as a whole number. */
export function knobOf(info: ToolInfo, tool: ToolInstance, key: string): number {
  const spec = info.knobs.find((candidate) => candidate.key === key);
  if (!spec) return 0;
  const value: unknown = tool.knobs?.[key];
  return Math.round(Math.min(spec.max, Math.max(spec.min, isNumber(value) ? value : spec.initial)));
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
 * - fit() reads only positions `from <= p < end`, and guess() only positions before `end`.
 * - fit() returns plain JSON (numbers, arrays, objects). It is stored in a save file.
 * - fit() depends on the tool's id and knobs, never its uid: a test flight shares one fit between copies of a tool.
 * - Neither changes the series, and guess() never changes params: one fit is reused for many guesses.
 * - guess() copes with any params, because an old save file may hold anything.
 * - guess() returns null only when it has no earlier reading to go on. Never NaN or Infinity.
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
