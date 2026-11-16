// Tests and measurements for one tool on its own, against the real record.
// Must not import ./tools or ./index, so a single tool can be compiled and checked alone:
//   npm run check -- --tool longMemory

import type { CheckResult, Target } from "../contracts";
import { allReadings } from "../lib/nasa/readings";
import {
  RELEARN_EVERY,
  TRAIN_WINDOW,
  checker,
  installed,
  plain,
  recent,
  seriesOf,
  toSeries,
  type Series,
  type ToolModule,
} from "./core";

/** Real stretches of the record the game is played on (rover sols, both ends included). */
export const WINDOWS: { name: string; fromSol: number; toSol: number }[] = [
  { name: "calm 2016", fromSol: 1227, toSol: 1256 },
  { name: "dust storm 2018", fromSol: 2062, toSol: 2121 },
  { name: "conjunction 2019", fromSol: 2495, toSol: 2534 },
];

const TARGETS: Target[] = ["nightLowC", "sunlight"];

function seriesThrough(sol: number, target: Target): Series {
  return toSeries(
    allReadings().filter((reading) => reading.sol <= sol),
    target,
  );
}

/** A copy of the series with every reading at a chosen position moved by 3. */
function shifted(series: Series, moved: (index: number) => boolean): Series {
  return seriesOf(
    series.target,
    series.points.map((point, index) => (moved(index) && point.value !== null ? { ...point, value: point.value + 3 } : point)),
  );
}

type Walk = { guesses: (number | null)[]; fitMs: number; fits: number; guessMs: number };

/** One tool walked forward from position `start` to the end of the series, learning again every ten sols. */
function walk(tool: ToolModule, series: Series, start: number): Walk {
  const result: Walk = { guesses: [], fitMs: 0, fits: 0, guessMs: 0 };
  const instance = installed(tool.info.id);
  let params: unknown = null;
  for (let position = start; position < series.points.length; position += 1) {
    if (tool.fit && (position - start) % RELEARN_EVERY === 0) {
      const started = performance.now();
      params = plain(tool.fit({ series, from: Math.max(0, position - TRAIN_WINDOW), end: position, tool: instance, seed: 1 }));
      result.fitMs += performance.now() - started;
      result.fits += 1;
    }
    const started = performance.now();
    const guess = tool.guess({ series, end: position, targetSol: series.points[position].sol, tool: instance, params });
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
  const instance = installed(tool.info.id);
  // The dust storm: the stretch where the readings change the most.
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
      const first = walk(tool, series, start).guesses;
      // Change every reading from the k-th guessed sol on. At k = 10 the tool learns again.
      for (const k of [0, RELEARN_EVERY]) {
        const second = walk(tool, shifted(series, (index) => index >= start + k), start).guesses;
        const moved = second.findIndex((guess, offset) => offset <= k && guess !== first[offset]);
        if (moved !== -1) return `guess ${moved} moved from ${first[moved]} to ${second[moved]} when sols from ${k} on changed`;
      }
      return true;
    });

    check(`${target}: fit() never looks before "from"`, () => {
      if (!tool.fit) return true;
      const from = start - 100;
      const fitted = (candidate: Series) =>
        JSON.stringify(plain(tool.fit?.({ series: candidate, from, end: start, tool: instance, seed: 1 })));
      const first = fitted(series);
      const second = fitted(shifted(series, (index) => index < from));
      return first === second ? true : "what fit() learned changed when only sols before from changed";
    });
  }

  check("changes neither the history nor its own params", () => {
    const series = seriesThrough(window.toSol, "nightLowC");
    const end = series.points.length;
    const before = JSON.stringify([series.points, [...series.bySol]]);
    const params = tool.fit ? plain(tool.fit({ series, from: end - TRAIN_WINDOW, end, tool: instance, seed: 1 })) : null;
    const saved = JSON.stringify(params);
    for (let position = end - 20; position < end; position += 1) {
      tool.guess({ series, end: position, targetSol: series.points[position].sol, tool: instance, params });
    }
    if (JSON.stringify([series.points, [...series.bySol]]) !== before) return "the history changed";
    return JSON.stringify(params) === saved ? true : "guess() changed its params";
  });

  check("copes with a history that is empty, tiny or full of gaps", () => {
    const { points } = seriesThrough(window.toSol, "nightLowC");
    const gappy = points.map((point, index) => (index % 3 === 0 ? { ...point, value: null } : point));
    for (const history of [[], points.slice(0, 2), points.slice(0, 9), gappy]) {
      const candidate = seriesOf("nightLowC", history);
      const end = history.length;
      const params = tool.fit
        ? plain(tool.fit({ series: candidate, from: Math.max(0, end - TRAIN_WINDOW), end, tool: instance, seed: 1 }))
        : null;
      const guess = tool.guess({ series: candidate, end, targetSol: 9999, tool: instance, params });
      if (guess !== null && !Number.isFinite(guess)) return `history of ${end}: ${guess}`;
      if (guess === null && candidate.points.some((point) => point.value !== null)) return `history of ${end}: no guess`;
    }
    return true;
  });

  check("fast enough: fit under 3 ms, guess under 0.05 ms", () => {
    const series = seriesThrough(window.toSol, "nightLowC");
    const start = series.points.findIndex((point) => point.sol >= window.fromSol);
    // The first walk warms up; the second is timed.
    walk(tool, series, start);
    const walked = walk(tool, series, start);
    const fitMs = walked.fits > 0 ? walked.fitMs / walked.fits : 0;
    const guessMs = walked.guessMs / walked.guesses.length;
    return fitMs < 3 && guessMs < 0.05 ? true : `fit ${fitMs.toFixed(2)} ms, guess ${guessMs.toFixed(3)} ms`;
  });

  return results;
}
