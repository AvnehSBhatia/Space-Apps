// Part A: the brain. The outpost computer's forecasting tools.
//
// Owner: Part A. This file is a working reference so Parts B and C are never blocked.
// Part A may rewrite anything in src/brain as long as `brain` keeps the BrainApi contract.
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

/** A Mars year is about 668 sols. */
const MARS_YEAR_SOLS = 668;
/** How many recent sols the brain learns from. */
const TRAIN_WINDOW = 120;
/** How far back a tool may look for its most recent readings. */
const LOOK_BACK = 60;
/** A test flight needs at least this many earlier sols to learn from. */
const MIN_TRAIN_SOLS = 30;

/** The rover's ultraviolet index as a number, so tools can do arithmetic on it. */
export const SUNLIGHT_LEVEL: Record<UvIndex, number> = { Low: 1, Moderate: 2, High: 3, Very_High: 4 };

const CATALOG: ToolInfo[] = [
  {
    id: "copycat",
    name: "Copycat",
    realName: "persistence forecast",
    blurb: "Guesses that tomorrow will be just like today.",
    energyWhPerSol: 0,
    knobs: [],
    learns: false,
    advanced: false,
    ready: true,
  },
  {
    id: "averager",
    name: "Averager",
    realName: "moving average",
    blurb: "Averages the last few sols, so one odd day does not fool it.",
    energyWhPerSol: 150,
    knobs: [{ key: "sols", label: "Sols to average", min: 2, max: 14, step: 1, initial: 5 }],
    learns: false,
    advanced: false,
    ready: true,
  },
  {
    id: "season",
    name: "Season Memory",
    realName: "seasonal forecast",
    blurb: "Looks up the same day one Mars year ago.",
    energyWhPerSol: 250,
    knobs: [],
    learns: false,
    advanced: false,
    ready: true,
  },
  {
    id: "trend",
    name: "Trend Line",
    realName: "linear trend",
    blurb: "Draws a line through the last few sols and follows where it is heading.",
    energyWhPerSol: 300,
    knobs: [{ key: "sols", label: "Sols in the line", min: 3, max: 10, step: 1, initial: 5 }],
    learns: false,
    advanced: false,
    ready: true,
  },
  // Advanced Lab. Part A builds these after the core game works. Until then they act as Copycat.
  {
    id: "neurons",
    name: "Neuron Pack",
    realName: "neural network",
    blurb: "A small network of adjustable knobs that learns its own rule.",
    energyWhPerSol: 900,
    knobs: [{ key: "neurons", label: "Neurons", min: 2, max: 16, step: 1, initial: 4 }],
    learns: true,
    advanced: true,
    ready: false,
  },
  {
    id: "spotlight",
    name: "Spotlight",
    realName: "attention",
    blurb: "Finds past days that looked like today and copies what came next.",
    energyWhPerSol: 1100,
    knobs: [{ key: "sols", label: "Sols to compare", min: 3, max: 10, step: 1, initial: 5 }],
    learns: true,
    advanced: true,
    ready: false,
  },
  {
    id: "longMemory",
    name: "Long Memory",
    realName: "state-space model",
    blurb: "Keeps a running memory that fades slowly.",
    energyWhPerSol: 700,
    knobs: [],
    learns: true,
    advanced: true,
    ready: false,
  },
];

const INFO = new Map<ToolId, ToolInfo>(CATALOG.map((tool) => [tool.id, tool]));
const DEFAULT_TOOL: ToolInstance = { uid: "default-copycat", id: "copycat", knobs: {} };

type Point = { sol: number; value: number | null };
type Series = { points: Point[]; bySol: Map<number, number | null> };
type Internals = { q10: number; q90: number };

function toSeries(history: SolReading[], target: Target): Series {
  const points = history.map((reading) => ({
    sol: reading.sol,
    value:
      target === "nightLowC" ? reading.minTempC : reading.uvIndex ? SUNLIGHT_LEVEL[reading.uvIndex] : null,
  }));
  return { points, bySol: new Map(points.map((point) => [point.sol, point.value])) };
}

function toolsOf(design: BrainDesign): ToolInstance[] {
  return design.tools.length > 0 ? design.tools : [DEFAULT_TOOL];
}

function knob(tool: ToolInstance, key: string): number {
  const spec = INFO.get(tool.id)?.knobs.find((candidate) => candidate.key === key);
  if (!spec) return 0;
  const value = tool.knobs[key];
  const chosen = typeof value === "number" && Number.isFinite(value) ? value : spec.initial;
  return Math.round(Math.min(spec.max, Math.max(spec.min, chosen)));
}

/** The most recent `count` readings before position `end`, newest first. Skips missing readings. */
function recent(points: Point[], end: number, count: number): number[] {
  const values: number[] = [];
  for (let index = end - 1; index >= 0 && index >= end - LOOK_BACK && values.length < count; index -= 1) {
    const value = points[index].value;
    if (value !== null) values.push(value);
  }
  return values;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** One tool's guess for the sol `targetSol`, using only positions before `end`. null when it has nothing to go on. */
function guessAt(tool: ToolInstance, series: Series, end: number, targetSol: number): number | null {
  const { points, bySol } = series;
  const last = recent(points, end, 1)[0];
  if (last === undefined) return null;

  switch (tool.id) {
    case "averager": {
      return mean(recent(points, end, knob(tool, "sols")));
    }
    case "season": {
      for (const offset of [0, 1, -1, 2, -2]) {
        const value = bySol.get(targetSol - MARS_YEAR_SOLS + offset);
        if (value !== null && value !== undefined) return value;
      }
      return last;
    }
    case "trend": {
      const values = recent(points, end, knob(tool, "sols")).reverse();
      if (values.length < 3) return last;
      const count = values.length;
      const meanX = (count - 1) / 2;
      const meanY = mean(values);
      let top = 0;
      let bottom = 0;
      values.forEach((value, x) => {
        top += (x - meanX) * (value - meanY);
        bottom += (x - meanX) ** 2;
      });
      const slope = bottom === 0 ? 0 : top / bottom;
      const guess = meanY + slope * (count - meanX);
      // Never run further past the recent readings than they are spread out.
      const low = Math.min(...values);
      const high = Math.max(...values);
      const spread = high - low;
      return Math.min(high + spread, Math.max(low - spread, guess));
    }
    // copycat, and every tool Part A has not built yet
    default:
      return last;
  }
}

function blend(guesses: (number | null)[], trust: number[]): number | null {
  let total = 0;
  let weight = 0;
  guesses.forEach((guess, index) => {
    if (guess !== null) {
      total += guess * trust[index];
      weight += trust[index];
    }
  });
  return weight > 0 ? total / weight : null;
}

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

const fallbackSpread = (target: Target) => (target === "nightLowC" ? 4 : 1);
const fallbackValue = (target: Target) => (target === "nightLowC" ? -70 : 2);

/**
 * Learn from positions before `end`: trust each tool by how close it has been lately,
 * and measure how wide the brain's misses are.
 */
function fit(tools: ToolInstance[], series: Series, end: number, target: Target): { trust: number[] } & Internals {
  const { points } = series;
  const squared = tools.map(() => 0);
  const counts = tools.map(() => 0);
  const rows: { actual: number; guesses: (number | null)[] }[] = [];

  for (let position = Math.max(1, end - TRAIN_WINDOW); position < end; position += 1) {
    const actual = points[position].value;
    if (actual === null) continue;
    const guesses = tools.map((tool) => guessAt(tool, series, position, points[position].sol));
    rows.push({ actual, guesses });
    guesses.forEach((guess, index) => {
      if (guess !== null) {
        squared[index] += (guess - actual) ** 2;
        counts[index] += 1;
      }
    });
  }

  const raw = tools.map((_, index) => (counts[index] > 0 ? 1 / (squared[index] / counts[index] + 0.05) : 0));
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  const trust = rawTotal > 0 ? raw.map((value) => value / rawTotal) : tools.map(() => 1 / tools.length);

  const residuals: number[] = [];
  for (const row of rows) {
    const guess = blend(row.guesses, trust);
    if (guess !== null) residuals.push(row.actual - guess);
  }
  residuals.sort((a, b) => a - b);
  const spread = fallbackSpread(target);
  const q10 = residuals.length >= 10 ? quantile(residuals, 0.1) : -spread;
  const q90 = residuals.length >= 10 ? quantile(residuals, 0.9) : spread;
  return { trust, q10: Math.min(q10, 0), q90: Math.max(q90, 0) };
}

function nextSol(points: Point[]): number {
  return points.length > 0 ? points[points.length - 1].sol + 1 : 0;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function energy(design: BrainDesign): number {
  return design.tools.reduce((sum, tool) => sum + (INFO.get(tool.id)?.energyWhPerSol ?? 0), 0);
}

function train(design: BrainDesign, history: SolReading[], target: Target, seed: number): TrainedBrain {
  void seed; // reserved for tools that need random numbers (see createRng in src/lib/rng.ts)
  const series = toSeries(history, target);
  const fitted = fit(toolsOf(design), series, series.points.length, target);
  const internals: Internals = { q10: fitted.q10, q90: fitted.q90 };
  return {
    design,
    target,
    trust: design.tools.length > 0 ? fitted.trust : [],
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
  const end = series.points.length;
  const guesses = tools.map((tool) => guessAt(tool, series, end, nextSol(series.points)));
  const value = blend(guesses, trust) ?? fallbackValue(target);

  const stored = trained.internals as Partial<Internals> | null;
  const spread = fallbackSpread(target);
  const q10 = typeof stored?.q10 === "number" && Number.isFinite(stored.q10) ? stored.q10 : -spread;
  const q90 = typeof stored?.q90 === "number" && Number.isFinite(stored.q90) ? stored.q90 : spread;

  const clamp = (number: number) => (target === "sunlight" ? Math.min(4, Math.max(1, number)) : number);
  const places = target === "sunlight" ? 2 : 1;
  return {
    target,
    value: round(clamp(value), places),
    low: round(clamp(value + q10), places),
    high: round(clamp(value + q90), places),
  };
}

type Flight = { misses: number[]; copycatMisses: number[]; points: GuessPoint[] };

function fly(tools: ToolInstance[], series: Series, target: Target, testSols: number): Flight {
  const { points } = series;
  const flight: Flight = { misses: [], copycatMisses: [], points: [] };
  const from = Math.max(MIN_TRAIN_SOLS, points.length - Math.max(1, Math.floor(testSols)));

  for (let position = from; position < points.length; position += 1) {
    const actual = points[position].value;
    const sol = points[position].sol;
    const { trust } = fit(tools, series, position, target);
    const guess = blend(
      tools.map((tool) => guessAt(tool, series, position, sol)),
      trust,
    );
    flight.points.push({ sol, actual, guess });
    if (actual === null || guess === null) continue;
    flight.misses.push(Math.abs(guess - actual));
    const copycat = recent(points, position, 1)[0];
    if (copycat !== undefined) flight.copycatMisses.push(Math.abs(copycat - actual));
  }
  return flight;
}

const average = (values: number[]) => (values.length > 0 ? mean(values) : 0);

function testFlight(
  design: BrainDesign,
  history: SolReading[],
  target: Target,
  testSols: number,
  seed: number,
): TestFlight {
  void seed; // reserved for tools that need random numbers
  const series = toSeries(history, target);
  const tools = toolsOf(design);
  const flight = fly(tools, series, target, testSols);
  const averageMiss = average(flight.misses);
  const count = flight.misses.length;
  const variance = count > 1 ? flight.misses.reduce((sum, miss) => sum + (miss - averageMiss) ** 2, 0) / (count - 1) : 0;

  const toolHelp = design.tools.map((tool) => {
    const others = design.tools.filter((other) => other.uid !== tool.uid);
    const without = average(fly(others.length > 0 ? others : [DEFAULT_TOOL], series, target, testSols).misses);
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
  const result: GuessPoint[] = [];
  for (let position = from; position < points.length; position += 1) {
    result.push({
      sol: points[position].sol,
      actual: points[position].value,
      guess: guessAt(tool, series, position, points[position].sol),
    });
  }
  return result;
}

function selfCheck(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, run: () => string | true) => {
    try {
      const outcome = run();
      results.push({ name, pass: outcome === true, detail: outcome === true ? "ok" : outcome });
    } catch (error) {
      results.push({ name, pass: false, detail: error instanceof Error ? error.message : "threw" });
    }
  };

  const history = allReadings().filter((reading) => reading.sol < 2100);
  const all: BrainDesign = {
    tools: (["copycat", "averager", "season", "trend"] as ToolId[]).map((id) => ({ uid: id, id, knobs: {} })),
  };
  const targets: Target[] = ["nightLowC", "sunlight"];

  check("the four core tools are ready", () => {
    const ready = CATALOG.filter((tool) => tool.ready && !tool.advanced).map((tool) => tool.id);
    return ready.length === 4 ? true : `ready core tools: ${ready.join(", ")}`;
  });

  check("an empty design acts as Copycat", () => {
    const empty = predict(train({ tools: [] }, history, "nightLowC", 1), history);
    const copycat = predict(train({ tools: [DEFAULT_TOOL] }, history, "nightLowC", 1), history);
    return empty.value === copycat.value ? true : `${empty.value} vs ${copycat.value}`;
  });

  check("forecasts are real numbers, low <= value <= high", () => {
    for (const target of targets) {
      const forecast = predict(train(all, history, target, 1), history);
      const numbers = [forecast.value, forecast.low, forecast.high];
      if (!numbers.every(Number.isFinite)) return `${target}: ${numbers.join(", ")}`;
      if (forecast.low > forecast.value || forecast.value > forecast.high) return `${target}: range out of order`;
    }
    return true;
  });

  check("trust adds up to 1", () => {
    const total = train(all, history, "nightLowC", 1).trust.reduce((sum, value) => sum + value, 0);
    return Math.abs(total - 1) < 1e-9 ? true : `sum ${total}`;
  });

  check("same input, same output", () => {
    const first = JSON.stringify(testFlight(all, history, "nightLowC", 30, 7));
    const second = JSON.stringify(testFlight(all, history, "nightLowC", 30, 7));
    return first === second ? true : "two runs differ";
  });

  check("a trained brain survives a save and load", () => {
    const trained = train(all, history, "nightLowC", 1);
    const loaded = JSON.parse(JSON.stringify(trained)) as TrainedBrain;
    return predict(loaded, history).value === predict(trained, history).value ? true : "forecast changed after JSON";
  });

  check("a test flight on 1,000 sols takes under 150 ms", () => {
    const thousand = history.slice(-1000);
    const started = performance.now();
    testFlight(all, thousand, "nightLowC", 30, 1);
    const elapsed = performance.now() - started;
    return elapsed < 150 ? true : `${elapsed.toFixed(0)} ms`;
  });

  return results;
}

export const brain: BrainApi = {
  catalog: () => CATALOG.map((tool) => ({ ...tool, knobs: tool.knobs.map((spec) => ({ ...spec })) })),
  energy,
  train,
  predict,
  testFlight,
  preview,
  selfCheck,
};
