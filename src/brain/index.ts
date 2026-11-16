// Part A: the brain. The outpost computer's forecasting engine.
//
// Owner: Part A. This file is the engine: it blends the tools, learns how much to trust each one,
// and runs test flights. Each tool is its own file in ./tools. Nothing outside src/brain depends on
// anything but the `brain` export and the BrainApi contract.
// No React, no DOM, no network, no Math.random, no Date in here.

import type {
  BrainApi,
  BrainDesign,
  CheckResult,
  Forecast,
  GuessPoint,
  SolReading,
  Target,
  TestFlight,
  ToolId,
  ToolInstance,
  TrainedBrain,
} from "../contracts";
import { allReadings } from "../lib/nasa/readings";
import { standardChecks } from "./bench";
import { checker, recent, round, toSeries, type Series } from "./core";
import { learnRange, readRange, type Range } from "./range";
import { TOOLS, moduleOf } from "./tools";
import { blend, learnTrust, type TrustRow } from "./trust";

export { SUNLIGHT_LEVEL } from "./core";

/** How many recent sols the brain learns from. */
const TRAIN_WINDOW = 160;
/** The newest part of that window is held back: tools do not learn from it, and trust is measured on it. */
const TRUST_WINDOW = 40;
/** A test flight needs at least this many earlier sols to learn from. */
const MIN_TRAIN_SOLS = 30;
/** During a test flight the brain re-learns this often, as it would on a real mission. */
const RELEARN_EVERY = 10;

const DEFAULT_TOOL: ToolInstance = { uid: "default-copycat", id: "copycat", knobs: {} };
const toolsOf = (design: BrainDesign): ToolInstance[] => (design.tools.length > 0 ? design.tools : [DEFAULT_TOOL]);

type Learned = { trust: number[]; range: Range; params: unknown[] };
/** What is stored in TrainedBrain.internals. */
type Internals = { range: Range; params: unknown[] };

/** Saved numbers must survive a save file, so everything a tool learns goes through JSON. */
function plain(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

/** Remembers what each tool learned during one call, so a test flight does not fit the same thing twice. */
type FitCache = Map<string, unknown>;

function fitAll(
  tools: ToolInstance[],
  series: Series,
  from: number,
  end: number,
  seed: number,
  cache?: FitCache,
): unknown[] {
  return tools.map((tool) => {
    const impl = moduleOf(tool.id);
    if (!impl.fit) return null;
    const key = `${tool.id}|${JSON.stringify(tool.knobs)}|${from}|${end}|${seed}`;
    if (cache?.has(key)) return cache.get(key);
    const params = plain(impl.fit({ series, from, end, tool, seed }));
    cache?.set(key, params);
    return params;
  });
}

function guessAll(
  tools: ToolInstance[],
  series: Series,
  end: number,
  targetSol: number,
  params: unknown[],
): (number | null)[] {
  return tools.map((tool, index) => {
    const guess = moduleOf(tool.id).guess({ series, end, targetSol, tool, params: params[index] ?? null });
    return guess !== null && Number.isFinite(guess) ? guess : null;
  });
}

/**
 * Learn from positions before `end`.
 * 1. Tools learn from the older part of the window.
 * 2. Trust and the forecast range are measured on the newest part, which the tools have not seen.
 * 3. Tools then learn again from the whole window, ready to forecast position `end`.
 */
function learn(tools: ToolInstance[], series: Series, end: number, seed: number, cache?: FitCache): Learned {
  const { points, target } = series;
  const from = Math.max(0, end - TRAIN_WINDOW);
  const span = end - from;
  const split = span >= TRUST_WINDOW * 2 ? end - TRUST_WINDOW : from + Math.floor(span / 2);

  const early = fitAll(tools, series, from, split, seed, cache);
  const rows: TrustRow[] = [];
  for (let position = Math.max(1, split); position < end; position += 1) {
    const actual = points[position].value;
    if (actual === null) continue;
    rows.push({ actual, guesses: guessAll(tools, series, position, points[position].sol, early) });
  }

  const trust = learnTrust(rows, tools.length);
  const misses: number[] = [];
  for (const row of rows) {
    const guess = blend(row.guesses, trust);
    if (guess !== null) misses.push(row.actual - guess);
  }
  return { trust, range: learnRange(misses, target), params: fitAll(tools, series, from, end, seed, cache) };
}

const fallbackValue = (target: Target) => (target === "nightLowC" ? -70 : 2);
const nextSol = (series: Series) => (series.points.length > 0 ? series.points[series.points.length - 1].sol + 1 : 0);

function energy(design: BrainDesign): number {
  return design.tools.reduce((sum, tool) => sum + moduleOf(tool.id).info.energyWhPerSol, 0);
}

function train(design: BrainDesign, history: SolReading[], target: Target, seed: number): TrainedBrain {
  const series = toSeries(history, target);
  const learned = learn(toolsOf(design), series, series.points.length, seed);
  const internals: Internals = { range: learned.range, params: learned.params };
  return {
    design,
    target,
    trust: design.tools.length > 0 ? learned.trust : [],
    energyWhPerSol: energy(design),
    trainedThroughSol: series.points.length > 0 ? series.points[series.points.length - 1].sol : 0,
    internals,
  };
}

function predict(trained: TrainedBrain, history: SolReading[]): Forecast {
  const target = trained.target;
  const series = toSeries(history, target);
  const tools = toolsOf(trained.design);
  const trust = trained.trust.length === tools.length ? trained.trust : tools.map(() => 1 / tools.length);
  const stored = trained.internals as Partial<Internals> | null;
  const params = Array.isArray(stored?.params) ? stored.params : [];
  const range = readRange(stored?.range, target);

  const guesses = guessAll(tools, series, series.points.length, nextSol(series), params);
  const value = blend(guesses, trust) ?? fallbackValue(target);
  const clamp = (number: number) => (target === "sunlight" ? Math.min(4, Math.max(1, number)) : number);
  const places = target === "sunlight" ? 2 : 1;
  return {
    target,
    value: round(clamp(value), places),
    low: round(clamp(value + range.low), places),
    high: round(clamp(value + range.high), places),
  };
}

type Flight = { misses: number[]; copycatMisses: number[]; points: GuessPoint[] };

/** Walk forward over the last `testSols` positions, always learning only from earlier ones. */
function fly(tools: ToolInstance[], series: Series, testSols: number, seed: number, cache: FitCache): Flight {
  const { points } = series;
  const flight: Flight = { misses: [], copycatMisses: [], points: [] };
  const from = Math.max(MIN_TRAIN_SOLS, points.length - Math.max(1, Math.floor(testSols)));
  let learned: Learned | null = null;

  for (let position = from; position < points.length; position += 1) {
    if (!learned || (position - from) % RELEARN_EVERY === 0) learned = learn(tools, series, position, seed, cache);
    const actual = points[position].value;
    const sol = points[position].sol;
    const guess = blend(guessAll(tools, series, position, sol, learned.params), learned.trust);
    flight.points.push({ sol, actual, guess: guess === null ? null : round(guess, 3) });
    if (actual === null || guess === null) continue;
    flight.misses.push(Math.abs(guess - actual));
    const copycat = recent(points, position, 1)[0];
    if (copycat !== undefined) flight.copycatMisses.push(Math.abs(copycat - actual));
  }
  return flight;
}

const average = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function testFlight(
  design: BrainDesign,
  history: SolReading[],
  target: Target,
  testSols: number,
  seed: number,
): TestFlight {
  const series = toSeries(history, target);
  const cache: FitCache = new Map();
  const flight = fly(toolsOf(design), series, testSols, seed, cache);
  const averageMiss = average(flight.misses);
  const count = flight.misses.length;
  const variance = count > 1 ? flight.misses.reduce((sum, miss) => sum + (miss - averageMiss) ** 2, 0) / (count - 1) : 0;

  const toolHelp = design.tools.map((tool) => {
    const others = design.tools.filter((other) => other.uid !== tool.uid);
    const without = average(fly(others.length > 0 ? others : [DEFAULT_TOOL], series, testSols, seed, cache).misses);
    return { uid: tool.uid, help: round(without - averageMiss, 3) };
  });

  return {
    target,
    averageMiss: round(averageMiss, 3),
    missNoise: round(count > 1 ? Math.sqrt(variance / count) : 0, 3),
    copycatMiss: round(average(flight.copycatMisses), 3),
    worstMiss: round(count > 0 ? Math.max(...flight.misses) : 0, 3),
    energyWhPerSol: energy(design),
    points: flight.points,
    toolHelp,
  };
}

function preview(tool: ToolInstance, history: SolReading[], target: Target, lastSols: number): GuessPoint[] {
  const series = toSeries(history, target);
  const { points } = series;
  const from = Math.max(1, points.length - Math.max(1, Math.floor(lastSols)));
  // A learning tool learns once, from the sols before the previewed stretch.
  const params = fitAll([tool], series, Math.max(0, from - TRAIN_WINDOW), from, 1);
  const result: GuessPoint[] = [];
  for (let position = from; position < points.length; position += 1) {
    const guess = guessAll([tool], series, position, points[position].sol, params)[0];
    result.push({ sol: points[position].sol, actual: points[position].value, guess: guess === null ? null : round(guess, 3) });
  }
  return result;
}

/**
 * How often the real value fell inside the forecast range over the last `testSols` sols,
 * forecasting each sol from only the sols before it. The range is meant to hold the truth 8 times in 10.
 */
export function rangeCoverage(
  design: BrainDesign,
  history: SolReading[],
  target: Target,
  testSols: number,
  seed = 1,
): { inside: number; total: number } {
  let inside = 0;
  let total = 0;
  for (let cut = Math.max(MIN_TRAIN_SOLS, history.length - Math.floor(testSols)); cut < history.length; cut += 1) {
    const actual = toSeries([history[cut]], target).points[0].value;
    if (actual === null) continue;
    const past = history.slice(0, cut);
    const forecast = predict(train(design, past, target, seed), past);
    total += 1;
    if (actual >= forecast.low && actual <= forecast.high) inside += 1;
  }
  return { inside, total };
}

function selfCheck(): CheckResult[] {
  const { results, check } = checker();
  const history = allReadings().filter((reading) => reading.sol < 2100);
  const ready = TOOLS.filter((tool) => tool.info.ready);
  const everyReadyTool: BrainDesign = {
    tools: ready.map((tool) => ({ uid: tool.info.id, id: tool.info.id, knobs: {} })),
  };
  const targets: Target[] = ["nightLowC", "sunlight"];

  check("the four core tools are ready", () => {
    const core = ready.filter((tool) => !tool.info.advanced).map((tool) => tool.info.id);
    return core.length === 4 ? true : `ready core tools: ${core.join(", ")}`;
  });

  check("an empty design acts as Copycat", () => {
    const empty = predict(train({ tools: [] }, history, "nightLowC", 1), history);
    const copycat = predict(train({ tools: [DEFAULT_TOOL] }, history, "nightLowC", 1), history);
    return empty.value === copycat.value ? true : `${empty.value} vs ${copycat.value}`;
  });

  check("forecasts are real numbers, low <= value <= high", () => {
    for (const target of targets) {
      const forecast = predict(train(everyReadyTool, history, target, 1), history);
      const numbers = [forecast.value, forecast.low, forecast.high];
      if (!numbers.every(Number.isFinite)) return `${target}: ${numbers.join(", ")}`;
      if (forecast.low > forecast.value || forecast.value > forecast.high) return `${target}: range out of order`;
    }
    return true;
  });

  check("trust is never negative and adds up to 1", () => {
    const trust = train(everyReadyTool, history, "nightLowC", 1).trust;
    const total = trust.reduce((sum, value) => sum + value, 0);
    return trust.every((value) => value >= 0) && Math.abs(total - 1) < 1e-9 ? true : `trust ${trust.join(", ")}`;
  });

  check("same input, same output", () => {
    const first = JSON.stringify(testFlight(everyReadyTool, history, "nightLowC", 30, 7));
    const second = JSON.stringify(testFlight(everyReadyTool, history, "nightLowC", 30, 7));
    return first === second ? true : "two runs differ";
  });

  check("a trained brain survives a save and load", () => {
    const trained = train(everyReadyTool, history, "nightLowC", 1);
    const loaded = JSON.parse(JSON.stringify(trained)) as TrainedBrain;
    return predict(loaded, history).value === predict(trained, history).value ? true : "forecast changed after JSON";
  });

  check("a test flight never looks at the sol it is guessing", () => {
    const changed = history.map((reading, index) =>
      index >= history.length - 30 && reading.minTempC !== null ? { ...reading, minTempC: reading.minTempC + 25 } : reading,
    );
    const first = testFlight(everyReadyTool, history, "nightLowC", 30, 1).points[0].guess;
    const second = testFlight(everyReadyTool, changed, "nightLowC", 30, 1).points[0].guess;
    return first === second ? true : `guess moved from ${first} to ${second} when only later sols changed`;
  });

  check("the night-low range holds the truth between 65% and 95% of the time", () => {
    for (const lastSol of [1256, 2121, 2534]) {
      const stretch = allReadings().filter((reading) => reading.sol <= lastSol);
      const { inside, total } = rangeCoverage(everyReadyTool, stretch, "nightLowC", 40);
      const share = total > 0 ? inside / total : 0;
      if (share < 0.65 || share > 0.95) return `sols up to ${lastSol}: ${inside} of ${total} inside the range`;
    }
    return true;
  });

  check("a short or empty history does not break anything", () => {
    for (const short of [[], history.slice(0, 1), history.slice(0, 12)]) {
      const forecast = predict(train(everyReadyTool, short, "nightLowC", 1), short);
      if (!Number.isFinite(forecast.value)) return `history of ${short.length}: ${forecast.value}`;
      testFlight(everyReadyTool, short, "nightLowC", 30, 1);
    }
    return true;
  });

  check("a test flight on 1,000 sols with every ready tool takes under 150 ms", () => {
    const thousand = history.slice(-1000);
    testFlight(everyReadyTool, thousand, "nightLowC", 30, 1);
    const started = performance.now();
    testFlight(everyReadyTool, thousand, "nightLowC", 30, 1);
    const elapsed = performance.now() - started;
    return elapsed < 150 ? true : `${elapsed.toFixed(0)} ms`;
  });

  for (const tool of ready) {
    for (const result of [...standardChecks(tool), ...(tool.checks?.() ?? [])]) {
      results.push({ ...result, name: `${tool.info.name}: ${result.name}` });
    }
  }
  return results;
}

/** Tool ids the engine knows, in catalog order. */
export const TOOL_IDS: ToolId[] = TOOLS.map((tool) => tool.info.id);

export const brain: BrainApi = {
  catalog: () => TOOLS.map((tool) => ({ ...tool.info, knobs: tool.info.knobs.map((spec) => ({ ...spec })) })),
  energy,
  train,
  predict,
  testFlight,
  preview,
  selfCheck,
};
