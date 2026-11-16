// Advanced Lab tool: attention over the past. It compares the shape of the last few readings with every
// earlier stretch of the same length, then averages what came next, giving close matches the most weight.

import {
  TRAIN_WINDOW,
  checker,
  installed,
  isNumber,
  knobOf,
  madeUpSeries,
  mean,
  plain,
  readings,
  type ToolModule,
} from "../core";

/** How many of the newest readings fit() scores each temperature on. */
const SCORE_LAST = 40;
/** Temperatures fit() tries, as multiples of how much the readings usually change from one sol to the next. */
const TEMPERATURE_TRIES = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8];

/** Variance of the one-step changes, at least 1e-6 so it can divide. */
function changeVariance(values: number[]): number {
  const changes: number[] = [];
  for (let index = 1; index < values.length; index += 1) changes.push(values[index] - values[index - 1]);
  if (changes.length < 2) return 1e-6;
  const average = mean(changes);
  const variance = mean(changes.map((change) => (change - average) ** 2));
  return Number.isFinite(variance) && variance > 1e-6 ? variance : 1e-6;
}

/**
 * How different the k readings ending just before `a` are from the k ending just before `b`, each measured
 * from its own newest reading, so only the shape counts. Mean squared difference.
 */
function distance(values: number[], k: number, a: number, b: number): number {
  const baseA = values[a - 1];
  const baseB = values[b - 1];
  let total = 0;
  for (let step = 2; step <= k; step += 1) {
    const diff = values[a - step] - baseA - (values[b - step] - baseB);
    total += diff * diff;
  }
  return total / (k - 1);
}

/**
 * How far the k readings just before `end` are from each memory. A memory is any earlier stretch of k readings
 * whose next reading is also before `end`; memory m ends just before reading k + m.
 */
function memoryDistances(values: number[], k: number, end: number): number[] {
  const distances: number[] = [];
  for (let next = k; next < end; next += 1) distances.push(distance(values, k, end, next));
  return distances;
}

/** Softmax-weighted average of the change that followed each memory. */
function attend(values: number[], k: number, distances: number[], temperature: number): number {
  let smallest = Infinity;
  for (const d of distances) if (d < smallest) smallest = d;
  let top = 0;
  let bottom = 0;
  for (let m = 0; m < distances.length; m += 1) {
    // Measuring from the closest match keeps its weight at 1, so exp() cannot round every weight to 0.
    const weight = Math.exp(-(distances[m] - smallest) / temperature);
    top += weight * (values[k + m] - values[k + m - 1]);
    bottom += weight;
  }
  return top / bottom;
}

/** The temperature from a save file, or null if it is missing or not a positive number. */
function storedTemperature(params: unknown): number | null {
  if (typeof params !== "object" || params === null) return null;
  const { temperature } = params as Record<string, unknown>;
  return isNumber(temperature) && temperature > 0 ? temperature : null;
}

export const spotlight: ToolModule = {
  info: {
    id: "spotlight",
    name: "Spotlight",
    realName: "attention",
    blurb: "Finds past days that looked like today and copies what came next.",
    energyWhPerSol: 1100,
    knobs: [{ key: "sols", label: "Sols to compare", min: 3, max: 10, step: 1, initial: 5 }],
    learns: true,
    advanced: true,
    ready: true,
  },
  fit: ({ series, from, end, tool }) => {
    const k = knobOf(spotlight.info, tool, "sols");
    const values = readings(series.points, Math.max(from, end - TRAIN_WINDOW), end);
    const variance = changeVariance(values);
    if (values.length < k + 12) return { temperature: variance };
    // Guess each of the newest readings from the memories before it, once per temperature.
    const errors = TEMPERATURE_TRIES.map(() => 0);
    for (let t = Math.max(k + 2, values.length - SCORE_LAST); t < values.length; t += 1) {
      const distances = memoryDistances(values, k, t);
      TEMPERATURE_TRIES.forEach((factor, which) => {
        const guess = values[t - 1] + attend(values, k, distances, variance * factor);
        errors[which] += (guess - values[t]) ** 2;
      });
    }
    let best = 0;
    errors.forEach((error, which) => {
      if (error < errors[best]) best = which;
    });
    return { temperature: variance * TEMPERATURE_TRIES[best] };
  },
  guess: ({ series, end, tool, params }) => {
    const k = knobOf(spotlight.info, tool, "sols");
    // Memories come from as far back as fit() looked.
    const values = readings(series.points, end - TRAIN_WINDOW, end);
    const count = values.length;
    if (count === 0) return null;
    if (count < k + 2) return values[count - 1];
    const temperature = storedTemperature(params) ?? changeVariance(values.slice(-SCORE_LAST));
    const guess = values[count - 1] + attend(values, k, memoryDistances(values, k, count), temperature);
    return Number.isFinite(guess) ? guess : values[count - 1];
  },
  checks: () => {
    const { results, check } = checker();
    const tool = installed("spotlight");
    const fitOn = (values: number[]) =>
      spotlight.fit?.({ series: madeUpSeries(values), from: 0, end: values.length, tool, seed: 1 });
    const guessOn = (values: number[], params: unknown) =>
      spotlight.guess({ series: madeUpSeries(values), end: values.length, targetSol: values.length + 1, tool, params });
    const wiggle = Array.from({ length: 60 }, (_, index) => -70 + Math.sin(index / 3) * 5);

    check("fit() returns a positive temperature that survives a round trip", () => {
      const params = fitOn(wiggle);
      return JSON.stringify(plain(params)) === JSON.stringify(params) && storedTemperature(plain(params)) !== null
        ? true
        : "fit() result changed or was not a positive number";
    });
    check("guess() copes with missing or broken params", () => {
      for (const params of [null, "old save", [1], { temperature: -1 }, { temperature: "2" }]) {
        const guess = guessOn(wiggle, params);
        if (guess === null || !Number.isFinite(guess)) return `params ${JSON.stringify(params)}: got ${guess}`;
      }
      return true;
    });
    check("a perfectly steady series is guessed as that value", () => {
      const steady = Array.from({ length: 40 }, () => -75);
      const guess = guessOn(steady, plain(fitOn(steady)));
      return guess === -75 ? true : `got ${guess}`;
    });
    check("a steadily rising series is guessed above the last reading", () => {
      const rising = Array.from({ length: 40 }, (_, index) => -90 + index);
      const guess = guessOn(rising, plain(fitOn(rising)));
      return guess !== null && guess > rising[39] ? true : `got ${guess}`;
    });
    return results;
  },
};
