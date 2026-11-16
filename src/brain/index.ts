// Part A: the brain. The outpost computer's forecasting engine.
//
// Owner: Part A. This file is the engine: it blends the tools, learns how much to trust each one,
// and runs test flights. Each tool is its own file in ./tools. Nothing outside src/brain depends on
// anything but the `brain` export and the BrainApi contract (the UI may also use ./scoreboard).
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
  ToolInfo,
  ToolInstance,
  TrainedBrain,
  UvIndex,
} from "../contracts";
import { allReadings } from "../lib/nasa/readings";
import { WINDOWS, standardChecks } from "./bench";
import {
  RELEARN_EVERY,
  TRAIN_WINDOW,
  checker,
  installed,
  isNumber,
  mean,
  plain,
  round,
  toSeries,
  type FitContext,
  type GuessContext,
  type Series,
  type ToolModule,
} from "./core";
import { learnRange, readRange, type Range } from "./range";
import { TOOLS, moduleOf } from "./tools";
import { blend, learnTrust, type TrustRow } from "./trust";

export { SUNLIGHT_LEVEL } from "./core";

/** The newest part of the training window is held back: tools do not learn from it, and trust is measured on it. */
const TRUST_WINDOW = 40;
/** A test flight needs at least this many earlier sols to learn from. */
const MIN_TRAIN_SOLS = 30;

/** What an empty design runs. */
const DEFAULT_TOOL = installed("copycat", "default-copycat");
const toolsOf = (design: BrainDesign): ToolInstance[] => (design.tools.length > 0 ? design.tools : [DEFAULT_TOOL]);

type Learned = { trust: number[]; range: Range; params: unknown[] };
/** What is stored in TrainedBrain.internals. */
type Internals = { range: Range; params: unknown[] };

/**
 * What one tool learns, as a save file stores it, or null if it does not learn.
 * A tool that throws learns nothing, so one broken tool cannot stop the brain.
 */
function fitOf(impl: ToolModule, context: FitContext): unknown {
  try {
    return impl.fit ? plain(impl.fit(context)) : null;
  } catch {
    return null;
  }
}

/** One tool's guess, or null if it has none. A tool that throws, or returns anything but a real number, has none. */
function guessOf(impl: ToolModule, context: GuessContext): number | null {
  try {
    const guess: unknown = impl.guess(context);
    return isNumber(guess) ? guess : null;
  } catch {
    return null;
  }
}

/**
 * Remembers what each tool learned during one call, so a test flight does not fit the same thing twice.
 * Safe because one call has one series and one seed, and fit() reads nothing else but the tool's id, knobs,
 * `from` and `end`, which are all in the key. Knob values that JSON writes alike (NaN, Infinity, missing)
 * all mean "use the initial value", so they fit alike too.
 */
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
    const params = fitOf(impl, { series, from, end, tool, seed });
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
  return tools.map((tool, index) =>
    guessOf(moduleOf(tool.id), { series, end, targetSol, tool, params: params[index] ?? null }),
  );
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

/** Saved trust, or equal trust when it is missing, the wrong length or damaged. */
function readTrust(saved: unknown, count: number): number[] {
  const ok =
    Array.isArray(saved) &&
    saved.length === count &&
    saved.every((share) => isNumber(share) && share >= 0) &&
    saved.some((share) => share > 0);
  return ok ? (saved as number[]) : Array.from({ length: count }, () => 1 / count);
}

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
  const trust = readTrust(trained.trust, tools.length);
  const stored = trained.internals as (Partial<Internals> & { q10?: unknown; q90?: unknown }) | null;
  const params = Array.isArray(stored?.params) ? stored.params : [];
  // A brain saved by the first version kept its range as { q10, q90 }.
  const range = readRange(stored?.range ?? { low: stored?.q10, high: stored?.q90 }, target);

  const guesses = guessAll(tools, series, series.points.length, nextSol(series), params);
  const blended = blend(guesses, trust) ?? fallbackValue(target);
  const clamp = (number: number) => (target === "sunlight" ? Math.min(4, Math.max(1, number)) : number);
  const places = target === "sunlight" ? 2 : 1;
  const value = round(clamp(blended), places);
  // min and max keep low <= value <= high even when a damaged save holds a range that misses 0.
  return {
    target,
    value,
    low: Math.min(value, round(clamp(blended + range.low), places)),
    high: Math.max(value, round(clamp(blended + range.high), places)),
  };
}

type Flight = { misses: number[]; copycatMisses: number[]; points: GuessPoint[] };

/** The newest reading before position `end`, however far back: what "same as last time" says. */
function lastReading(series: Series, end: number): number | undefined {
  for (let index = end - 1; index >= 0; index -= 1) {
    const value = series.points[index].value;
    if (value !== null) return value;
  }
  return undefined;
}

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
    const copycat = lastReading(series, position);
    if (actual === null || guess === null || copycat === undefined) continue;
    // Both misses are counted on the same sols, so they can be compared.
    flight.misses.push(Math.abs(guess - actual));
    flight.copycatMisses.push(Math.abs(copycat - actual));
  }
  return flight;
}

/** The mean, or 0 when there is nothing to average: a test flight too short to measure reports a miss of 0. */
const average = (values: number[]) => (values.length > 0 ? mean(values) : 0);

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

  const toolHelp = design.tools.map((tool, index) => {
    const others = design.tools.filter((_, otherIndex) => otherIndex !== index);
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

function catalog(): ToolInfo[] {
  return TOOLS.map((tool) => ({ ...tool.info, knobs: tool.info.knobs.map((knob) => ({ ...knob })) }));
}

/** What is wrong with a forecast, or null if nothing is. */
function badForecast(forecast: Forecast, target: Target): string | null {
  const { value, low, high } = forecast;
  if (forecast.target !== target) return `target is ${forecast.target}`;
  if (![value, low, high].every(Number.isFinite)) return `not real numbers: ${low}, ${value}, ${high}`;
  if (low > value || value > high) return `out of order: ${low}, ${value}, ${high}`;
  if (target === "sunlight" && (low < 1 || high > 4)) return `sunlight outside 1 to 4: ${low} to ${high}`;
  return null;
}

/** What is wrong with the trust for `count` tools, or null if nothing is. */
function badTrust(trust: number[], count: number): string | null {
  if (trust.length !== count) return `${trust.length} trust shares for ${count} tools`;
  const total = trust.reduce((sum, share) => sum + share, 0);
  const shares = trust.every((share) => Number.isFinite(share) && share >= 0 && share <= 1);
  return count === 0 || (shares && Math.abs(total - 1) < 1e-9) ? null : `trust ${trust.join(", ")}`;
}

/** True when a value comes back from JSON.stringify and JSON.parse exactly as it went in. */
function jsonSafe(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonSafe);
  const plainObject = typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
  return plainObject && Object.values(value).every(jsonSafe);
}

/** The same sol with a very different night low and sunlight, for the no-peeking checks. */
const scrambled = (reading: SolReading): SolReading => ({
  ...reading,
  minTempC: reading.minTempC === null ? null : reading.minTempC + 25,
  uvIndex: reading.uvIndex === null ? null : reading.uvIndex === "Low" ? "Very_High" : "Low",
});

function selfCheck(): CheckResult[] {
  const { results, check } = checker();
  // The record up to a sol inside the 2018 dust storm, so the checks run on a hard stretch.
  const history = allReadings().filter((reading) => reading.sol < 2100);
  const ready = TOOLS.filter((tool) => tool.info.ready);
  const everyReadyTool: BrainDesign = { tools: ready.map((tool) => installed(tool.info.id)) };
  const targets: Target[] = ["nightLowC", "sunlight"];

  check("the four core tools are ready", () => {
    const core = ready.filter((tool) => !tool.info.advanced).map((tool) => tool.info.id);
    return core.length === 4 ? true : `ready core tools: ${core.join(", ")}`;
  });

  check("the catalog describes every tool properly", () => {
    const ids = TOOLS.map((tool) => tool.info.id);
    if (new Set(ids).size !== ids.length) return `a tool id is repeated: ${ids.join(", ")}`;
    for (const tool of TOOLS) {
      const { id, learns, energyWhPerSol, knobs } = tool.info;
      if (learns !== Boolean(tool.fit)) return `${id}: learns is ${learns}, but fit() ${tool.fit ? "exists" : "does not"}`;
      if (!Number.isFinite(energyWhPerSol) || energyWhPerSol < 0) return `${id}: energy ${energyWhPerSol}`;
      if (new Set(knobs.map((knob) => knob.key)).size !== knobs.length) return `${id}: a knob key is repeated`;
      const bad = knobs.find((knob) => !(knob.min <= knob.initial && knob.initial <= knob.max && knob.step > 0));
      if (bad) return `${id}: knob ${bad.key} needs min <= initial <= max and a positive step`;
    }
    return true;
  });

  check("catalog() hands out copies, so a caller cannot change the engine's tools", () => {
    const before = JSON.stringify(catalog());
    const energyBefore = energy(everyReadyTool);
    for (const info of catalog()) {
      info.name = "changed";
      info.energyWhPerSol = -1;
      info.ready = !info.ready;
      info.knobs.forEach((knob) => (knob.max = -1));
      info.knobs.push({ key: "extra", label: "extra", min: 0, max: 1, step: 1, initial: 0 });
    }
    const copy = catalog();
    copy[0].name = "changed";
    copy.pop();
    const unchanged = JSON.stringify(catalog()) === before && energy(everyReadyTool) === energyBefore;
    return unchanged ? true : "changing a copy changed the engine";
  });

  check("an empty design acts as Copycat", () => {
    for (const target of targets) {
      const empty = train({ tools: [] }, history, target, 1);
      if (empty.trust.length > 0) return `${target}: an empty design has trust ${empty.trust.join(", ")}`;
      const forecast = JSON.stringify(predict(empty, history));
      const copycat = JSON.stringify(predict(train({ tools: [DEFAULT_TOOL] }, history, target, 1), history));
      if (forecast !== copycat) return `${target}: ${forecast} vs ${copycat}`;
      const flight = testFlight({ tools: [] }, history, target, 30, 1);
      if (flight.averageMiss !== flight.copycatMiss) return `${target}: miss ${flight.averageMiss} vs ${flight.copycatMiss}`;
      if (flight.toolHelp.length > 0 || flight.energyWhPerSol !== 0) return `${target}: tool help or energy for no tools`;
    }
    return true;
  });

  check("forecasts are real numbers, low <= value <= high, sunlight within 1 to 4", () => {
    for (const target of targets) {
      const problem = badForecast(predict(train(everyReadyTool, history, target, 1), history), target);
      if (problem) return `${target}: ${problem}`;
    }
    return true;
  });

  check("trust has one share per tool, in design order, each 0 to 1, adding up to 1", () => {
    const twice: BrainDesign = {
      tools: [...everyReadyTool.tools, ...everyReadyTool.tools.map((tool) => ({ ...tool, uid: `${tool.uid}-again` }))],
    };
    for (const design of [everyReadyTool, twice, { tools: [DEFAULT_TOOL] }]) {
      for (const target of targets) {
        const problem = badTrust(train(design, history, target, 1).trust, design.tools.length);
        if (problem) return `${target}, ${design.tools.length} tools: ${problem}`;
      }
    }
    // Each tool's share does not depend on where it sits, so reversing the design reverses the trust.
    const forward = train(everyReadyTool, history, "nightLowC", 1).trust;
    const backward = train({ tools: [...everyReadyTool.tools].reverse() }, history, "nightLowC", 1).trust.reverse();
    const inOrder = forward.every((share, index) => Math.abs(share - backward[index]) < 1e-12);
    return inOrder ? true : "trust is not in design order";
  });

  check("same input, same output", () => {
    for (const target of targets) {
      const run = () =>
        JSON.stringify([train(everyReadyTool, history, target, 7), testFlight(everyReadyTool, history, target, 30, 7)]);
      if (run() !== run()) return `${target}: two runs differ`;
    }
    return true;
  });

  check("a trained brain survives a save and load, even with every ready tool", () => {
    for (const target of targets) {
      const trained = train(everyReadyTool, history, target, 1);
      if (!jsonSafe(trained)) return `${target}: it holds something JSON cannot carry`;
      const before = JSON.stringify(predict(trained, history));
      const after = JSON.stringify(predict(JSON.parse(JSON.stringify(trained)) as TrainedBrain, history));
      if (before !== after) return `${target}: forecast ${before} became ${after}`;
    }
    return true;
  });

  check("an old or damaged save still gives a sensible forecast", () => {
    for (const target of targets) {
      const trained = train(everyReadyTool, history, target, 1);
      const old = predict({ ...trained, internals: { q10: -3, q90: 2 } }, history);
      const usesOld = Math.abs(old.value - old.low - 3) < 0.11 && Math.abs(old.high - old.value - 2) < 0.11;
      if (target === "nightLowC" && !usesOld) return `the old { q10, q90 } range was not used: ${JSON.stringify(old)}`;
      const damaged: Partial<TrainedBrain>[] = [
        { internals: undefined },
        { internals: null },
        { internals: "an old save" },
        { internals: { range: { low: 3, high: -3 }, params: [null, 5, "x", {}, [], { alpha: 2 }, { temperature: -1 }] } },
        { trust: [] },
        { trust: everyReadyTool.tools.map(() => Number.NaN) },
        { trust: everyReadyTool.tools.map(() => 0) },
        { trust: null as unknown as number[] },
      ];
      for (const change of damaged) {
        const problem = badForecast(predict({ ...trained, ...change }, history), target);
        if (problem) return `${target}, ${JSON.stringify(change)}: ${problem}`;
      }
    }
    return true;
  });

  check("a test flight never looks at the sol it is guessing, or later", () => {
    const tools = toolsOf(everyReadyTool);
    for (const target of targets) {
      const first = fly(tools, toSeries(history, target), 30, 1, new Map()).points;
      // Change every sol from the k-th test sol on. At k = 10 the brain learns again.
      for (const k of [0, RELEARN_EVERY, 29]) {
        const changed = history.map((reading, index) => (index >= history.length - 30 + k ? scrambled(reading) : reading));
        const second = fly(tools, toSeries(changed, target), 30, 1, new Map()).points;
        const moved = second.findIndex((point, offset) => offset <= k && point.guess !== first[offset].guess);
        if (moved !== -1) return `${target}: guess ${moved} moved when only sols from test sol ${k} on changed`;
      }
    }
    return true;
  });

  check("a preview never looks at the sol it is guessing, or later", () => {
    for (const target of targets) {
      for (const tool of everyReadyTool.tools) {
        const first = preview(tool, history, target, 10);
        // Change every sol from the k-th previewed sol on.
        for (const k of [0, 5]) {
          const changed = history.map((reading, index) => (index >= history.length - 10 + k ? scrambled(reading) : reading));
          const second = preview(tool, changed, target, 10);
          const moved = second.findIndex((point, offset) => offset <= k && point.guess !== first[offset].guess);
          if (moved !== -1) return `${target}, ${tool.id}: guess ${moved} moved when only sols from ${k} on changed`;
        }
      }
    }
    return true;
  });

  check("tool help has one entry per tool, in order, and a second copy of a tool helps 0", () => {
    const flight = testFlight(everyReadyTool, history, "nightLowC", 30, 1);
    if (flight.toolHelp.map((entry) => entry.uid).join() !== everyReadyTool.tools.map((tool) => tool.uid).join()) {
      return `tool help is for ${flight.toolHelp.map((entry) => entry.uid).join(", ")}`;
    }
    // Without one copy the other still makes exactly the same guesses.
    const copies: BrainDesign = { tools: [installed("trend", "one"), installed("trend", "two")] };
    const help = testFlight(copies, history, "nightLowC", 30, 1).toolHelp.map((entry) => entry.help);
    return help.every((value) => value === 0) ? true : `a copy's help was ${help.join(", ")}`;
  });

  check("a test flight measures Copycat on the same sols as the brain, even after a long gap", () => {
    // 200 sols at -80 C, 70 sols with no reading, then 20 sols at -60 C.
    const gap: SolReading[] = Array.from({ length: 290 }, (_, index) => ({
      ...history[0],
      sol: index + 1,
      minTempC: index < 200 ? -80 : index < 270 ? null : -60,
    }));
    const flight = testFlight({ tools: [installed("longMemory")] }, gap, "nightLowC", 20, 1);
    // Copycat says -80 on the first sol after the gap, then is right: 20 C of misses over 20 sols.
    return flight.copycatMiss === 1 ? true : `Copycat's miss was ${flight.copycatMiss}, not 1`;
  });

  check("the night-low range holds the truth between 65% and 95% of the time", () => {
    for (const window of WINDOWS) {
      const stretch = allReadings().filter((reading) => reading.sol <= window.toSol);
      const { inside, total } = rangeCoverage(everyReadyTool, stretch, "nightLowC", 40);
      const share = total > 0 ? inside / total : 0;
      if (share < 0.65 || share > 0.95) return `${window.name}: ${inside} of ${total} inside the range`;
    }
    return true;
  });

  check("odd designs and histories never throw and never give NaN or Infinity", () => {
    const base = history.slice(-200);
    const designs: BrainDesign[] = [
      { tools: [] },
      // Every tool in the catalog, ready or not, and one this version does not know.
      { tools: [...TOOLS.map((tool) => installed(tool.info.id)), installed("retired" as unknown as ToolId)] },
      // The same tool twice, with different uids.
      {
        tools: [
          { uid: "a", id: "spotlight", knobs: { sols: 3 } },
          { uid: "b", id: "spotlight", knobs: { sols: 9 } },
          { uid: "c", id: "neurons", knobs: {} },
          { uid: "d", id: "neurons", knobs: {} },
        ],
      },
      // Knobs out of range, not numbers, unknown, or missing altogether.
      {
        tools: [
          { uid: "a", id: "averager", knobs: { sols: 999 } },
          { uid: "b", id: "trend", knobs: { sols: -5 } },
          { uid: "c", id: "spotlight", knobs: { sols: Number.NaN } },
          { uid: "d", id: "neurons", knobs: { neurons: Infinity, other: 3 } },
          { uid: "e", id: "spotlight" } as unknown as ToolInstance,
          { uid: "f", id: "neurons" } as unknown as ToolInstance,
        ],
      },
    ];
    const blank = (reading: SolReading): SolReading => ({ ...reading, minTempC: null, uvIndex: null });
    const broken = (reading: SolReading, index: number): SolReading =>
      index % 4 === 0
        ? { ...reading, minTempC: index % 8 === 0 ? Number.NaN : 1e300, uvIndex: "Bogus" as unknown as UvIndex }
        : reading;
    // Every 7th sol missing, and every 3rd reading of the rest null.
    const gaps = base
      .filter((_, index) => index % 7 !== 3)
      .map((reading, index) => (index % 3 === 0 ? blank(reading) : reading));
    const histories: [string, SolReading[]][] = [
      ["no history", []],
      ["one sol", base.slice(0, 1)],
      ["12 sols", base.slice(0, 12)],
      ["every reading null", base.map(blank)],
      ["gaps", gaps],
      ["broken values", base.map(broken)],
    ];
    for (const design of designs) {
      for (const [name, sols] of histories) {
        for (const target of targets) {
          const where = `${design.tools.length} tools, ${name}, ${target}`;
          try {
            const trained = train(design, sols, target, 3);
            const trustProblem = badTrust(trained.trust, design.tools.length);
            if (trustProblem) return `${where}: ${trustProblem}`;
            if (!jsonSafe(trained.internals)) return `${where}: internals JSON cannot carry`;
            const forecast = predict(trained, sols);
            const problem = badForecast(forecast, target);
            if (problem) return `${where}: ${problem}`;
            const loaded = predict(JSON.parse(JSON.stringify(trained)) as TrainedBrain, sols);
            if (JSON.stringify(loaded) !== JSON.stringify(forecast)) return `${where}: a save and load changed the forecast`;
            const flight = testFlight(design, sols, target, 12, 3);
            if (!jsonSafe(flight) || flight.toolHelp.length !== design.tools.length) return `${where}: bad test flight`;
            for (const tool of design.tools) {
              if (!jsonSafe(preview(tool, sols, target, 10))) return `${where}: bad preview of ${tool.id}`;
            }
          } catch (error) {
            return `${where}: threw ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }
    }
    return true;
  });

  check("a tool that throws, or guesses something that is not a number, is left out of the blend", () => {
    const fail = () => {
      throw new Error("a broken tool");
    };
    const { info } = moduleOf("copycat");
    const series = toSeries(history, "nightLowC");
    const end = series.points.length;
    const learned = fitOf({ info, fit: fail, guess: fail }, { series, from: 0, end, tool: DEFAULT_TOOL, seed: 1 });
    const guesses = [fail, () => Number.NaN, () => Infinity].map((guess) =>
      guessOf({ info, guess }, { series, end, targetSol: nextSol(series), tool: DEFAULT_TOOL, params: null }),
    );
    if (learned !== null || guesses.some((guess) => guess !== null)) {
      return `learned ${JSON.stringify(learned)}, guessed ${guesses.join(", ")}`;
    }
    // The tools that are left share the forecast between them.
    const blended = blend([...guesses, -70], [0.25, 0.25, 0.25, 0.25]);
    return blended === -70 ? true : `the blend was ${blended}, not -70`;
  });

  check("on 1,000 sols, with every ready tool at its slowest setting, train() and a test flight take under 150 ms", () => {
    const thousand = history.slice(-1000);
    const slowest: BrainDesign = {
      tools: ready.map((tool) => ({
        uid: tool.info.id,
        id: tool.info.id,
        knobs: Object.fromEntries(tool.info.knobs.map((knob) => [knob.key, knob.max])),
      })),
    };
    // The first run warms up; the second is timed.
    const timed = (run: () => void) => {
      run();
      const started = performance.now();
      run();
      return performance.now() - started;
    };
    const trainMs = timed(() => train(slowest, thousand, "nightLowC", 1));
    const flightMs = timed(() => testFlight(slowest, thousand, "nightLowC", 30, 1));
    return trainMs < 150 && flightMs < 150 ? true : `train ${trainMs.toFixed(0)} ms, test flight ${flightMs.toFixed(0)} ms`;
  });

  for (const tool of ready) {
    let own: CheckResult[];
    try {
      own = [...standardChecks(tool), ...(tool.checks?.() ?? [])];
    } catch (error) {
      own = [{ name: "checks", pass: false, detail: error instanceof Error ? error.message : "threw" }];
    }
    for (const result of own) results.push({ ...result, name: `${tool.info.name}: ${result.name}` });
  }
  return results;
}

/** Tool ids the engine knows, in catalog order. */
export const TOOL_IDS: ToolId[] = TOOLS.map((tool) => tool.info.id);

export const brain: BrainApi = {
  catalog,
  energy,
  train,
  predict,
  testFlight,
  preview,
  selfCheck,
};
