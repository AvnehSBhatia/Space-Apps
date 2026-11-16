// Tests and measurements for one tool on its own, against the real record.
// Must not import ./tools or ./index, so a single tool can be compiled and checked alone:
//   npm run check -- --tool longMemory

import type { CheckResult, Target, ToolInstance } from "../contracts";
import { allReadings } from "../lib/nasa/readings";
import { checker, recent, toSeries, type Series, type ToolModule } from "./core";

const TRAIN_WINDOW = 160;
const RELEARN_EVERY = 10;

/** Real stretches of the record the game is played on (rover sols, both ends included). */
export const WINDOWS: { name: string; fromSol: number; toSol: number }[] = [
  { name: "calm 2016", fromSol: 1227, toSol: 1256 },
  { name: "dust storm 2018", fromSol: 2062, toSol: 2121 },
  { name: "conjunction 2019", fromSol: 2495, toSol: 2534 },
];

const TARGETS: Target[] = ["nightLowC", "sunlight"];
const instance = (tool: ToolModule): ToolInstance => ({ uid: tool.info.id, id: tool.info.id, knobs: {} });
const plain = (value: unknown): unknown => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

function seriesThrough(sol: number, target: Target): Series {
  return toSeries(
    allReadings().filter((reading) => reading.sol <= sol),
    target,
  );
}

type Walk = { guesses: (number | null)[]; fitMs: number; fits: number; guessMs: number };

/** One tool walked forward from position `start` to the end of the series, re-learning every ten sols. */
function walk(tool: ToolModule, series: Series, start: number, seed = 1): Walk {
  const result: Walk = { guesses: [], fitMs: 0, fits: 0, guessMs: 0 };
  let params: unknown = null;
  for (let position = start; position < series.points.length; position += 1) {
    if (tool.fit && (position - start) % RELEARN_EVERY === 0) {
      const started = performance.now();
      params = plain(tool.fit({ series, from: Math.max(0, position - TRAIN_WINDOW), end: position, tool: instance(tool), seed }));
      result.fitMs += performance.now() - started;
      result.fits += 1;
    }
    const started = performance.now();
    const guess = tool.guess({ series, end: position, targetSol: series.points[position].sol, tool: instance(tool), params });
    result.guessMs += performance.now() - started;
    result.guesses.push(guess);
  }
  return result;
}

export type BenchRow = {
  window: string;
  target: Target;
  /** Average distance between the tool's guess and the truth. */
  toolMiss: number;
  /** The same for "same as last time". */
  copycatMiss: number;
  /** Average milliseconds for one fit(), or 0 if the tool does not learn. */
  fitMs: number;
  /** Average milliseconds for one guess(). */
  guessMs: number;
};

/** How one tool does alone on each real stretch, next to Copycat. */
export function benchTool(tool: ToolModule): BenchRow[] {
  const rows: BenchRow[] = [];
  for (const window of WINDOWS) {
    for (const target of TARGETS) {
      const series = seriesThrough(window.toSol, target);
      const start = series.points.findIndex((point) => point.sol >= window.fromSol);
      const walked = walk(tool, series, start);
      let toolTotal = 0;
      let copycatTotal = 0;
      let count = 0;
      walked.guesses.forEach((guess, offset) => {
        const position = start + offset;
        const actual = series.points[position].value;
        const copycat = recent(series.points, position, 1)[0];
        if (actual === null || guess === null || copycat === undefined) return;
        toolTotal += Math.abs(guess - actual);
        copycatTotal += Math.abs(copycat - actual);
        count += 1;
      });
      rows.push({
        window: window.name,
        target,
        toolMiss: count > 0 ? toolTotal / count : 0,
        copycatMiss: count > 0 ? copycatTotal / count : 0,
        fitMs: walked.fits > 0 ? walked.fitMs / walked.fits : 0,
        guessMs: walked.guesses.length > 0 ? walked.guessMs / walked.guesses.length : 0,
      });
    }
  }
  return rows;
}

/** Checks every tool must pass, whatever it does inside. */
export function standardChecks(tool: ToolModule): CheckResult[] {
  const { results, check } = checker();
  const window = WINDOWS[1];

  for (const target of TARGETS) {
    const series = seriesThrough(window.toSol, target);
    const start = series.points.findIndex((point) => point.sol >= window.fromSol);

    check(`${target}: every guess is a real number`, () => {
      const bad = walk(tool, series, start).guesses.findIndex((guess) => guess === null || !Number.isFinite(guess));
      return bad === -1 ? true : `guess ${bad} was not a real number`;
    });

    check(`${target}: same input, same output`, () => {
      const first = JSON.stringify(walk(tool, series, start).guesses);
      const second = JSON.stringify(walk(tool, series, start).guesses);
      return first === second ? true : "two runs differ";
    });

    check(`${target}: never looks at the sol it is guessing, or later`, () => {
      const later = {
        ...series,
        points: series.points.map((point, index) =>
          index >= start && point.value !== null ? { ...point, value: point.value + 3 } : point,
        ),
      };
      later.bySol = new Map(later.points.map((point) => [point.sol, point.value]));
      const first = walk(tool, series, start).guesses[0];
      const second = walk(tool, later, start).guesses[0];
      return first === second ? true : `first guess moved from ${first} to ${second} when only later sols changed`;
    });
  }

  check("copes with a history that is empty, tiny or full of gaps", () => {
    const full = seriesThrough(window.toSol, "nightLowC");
    const gappy = {
      ...full,
      points: full.points.map((point, index) => (index % 3 === 0 ? { ...point, value: null } : point)),
    };
    gappy.bySol = new Map(gappy.points.map((point) => [point.sol, point.value]));
    for (const candidate of [
      { ...full, points: [], bySol: new Map<number, number | null>() },
      { ...full, points: full.points.slice(0, 2) },
      { ...full, points: full.points.slice(0, 9) },
      gappy,
    ]) {
      const end = candidate.points.length;
      const params = tool.fit
        ? plain(tool.fit({ series: candidate, from: Math.max(0, end - TRAIN_WINDOW), end, tool: instance(tool), seed: 1 }))
        : null;
      const guess = tool.guess({ series: candidate, end, targetSol: 9999, tool: instance(tool), params });
      if (guess !== null && !Number.isFinite(guess)) return `history of ${end}: ${guess}`;
      if (guess === null && candidate.points.some((point) => point.value !== null)) return `history of ${end}: no guess`;
    }
    return true;
  });

  check("fast enough: fit under 3 ms, guess under 0.05 ms", () => {
    const series = seriesThrough(window.toSol, "nightLowC");
    const start = series.points.findIndex((point) => point.sol >= window.fromSol);
    walk(tool, series, start);
    const walked = walk(tool, series, start);
    const fitMs = walked.fits > 0 ? walked.fitMs / walked.fits : 0;
    const guessMs = walked.guessMs / walked.guesses.length;
    return fitMs < 3 && guessMs < 0.05 ? true : `fit ${fitMs.toFixed(2)} ms, guess ${guessMs.toFixed(3)} ms`;
  });

  return results;
}
