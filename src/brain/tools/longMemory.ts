// Advanced Lab tool: Holt's linear smoothing, a level and a trend that fade slowly.
// fit() picks the two smoothing constants; guess() runs the smoother and steps one sol ahead.

import {
  TRAIN_WINDOW,
  checker,
  installed,
  isNumber,
  madeUpSeries,
  plain,
  readings,
  withinReach,
  type Series,
  type ToolModule,
} from "../core";

type Params = { alpha: number; beta: number };

const DEFAULTS: Params = { alpha: 0.8, beta: 0.1 };
const ALPHAS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const BETAS = [0, 0.05, 0.1, 0.2, 0.4];

const inRange = (value: unknown, low: number, high: number): value is number =>
  isNumber(value) && value >= low && value <= high;

/** The constants from a save file, or the defaults if they are missing or not ones fit() could choose. */
function readParams(params: unknown): Params {
  if (typeof params !== "object" || params === null) return DEFAULTS;
  const { alpha, beta } = params as Record<string, unknown>;
  return inRange(alpha, ALPHAS[0], 1) && inRange(beta, 0, 1) ? { alpha, beta } : DEFAULTS;
}

/**
 * Runs the smoother over values (oldest first, at least one).
 * Returns its guess for the next value, and the sum of its squared one-step misses along the way.
 */
function smooth(values: number[], alpha: number, beta: number): { forecast: number; squaredError: number } {
  let level = values[0];
  let trend = 0;
  let squaredError = 0;
  for (let index = 1; index < values.length; index += 1) {
    const error = values[index] - (level + trend);
    squaredError += error * error;
    const newLevel = alpha * values[index] + (1 - alpha) * (level + trend);
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
  }
  return { forecast: level + trend, squaredError };
}

export const longMemory: ToolModule = {
  info: {
    id: "longMemory",
    name: "Long Memory",
    realName: "state-space model",
    blurb: "Keeps a running memory that fades slowly.",
    energyWhPerSol: 700,
    knobs: [],
    learns: true,
    advanced: true,
    ready: true,
  },
  fit: ({ series, from, end }) => {
    const values = readings(series.points, Math.max(from, end - TRAIN_WINDOW), end);
    if (values.length < 10) return { ...DEFAULTS };
    // Start from the defaults, so a series that cannot tell the constants apart (a flat one) keeps them.
    let best = { ...DEFAULTS };
    let bestError = smooth(values, best.alpha, best.beta).squaredError;
    for (const alpha of ALPHAS) {
      for (const beta of BETAS) {
        const { squaredError } = smooth(values, alpha, beta);
        if (squaredError < bestError) {
          bestError = squaredError;
          best = { alpha, beta };
        }
      }
    }
    return best;
  },
  guess: ({ series, end, params }) => {
    // The smoother starts as far back as fit() looked, so the constants mean the same thing in both.
    const values = readings(series.points, end - TRAIN_WINDOW, end);
    if (values.length === 0) return null;
    const { alpha, beta } = readParams(params);
    const { forecast } = smooth(values, alpha, beta);
    return Number.isFinite(forecast) ? withinReach(values, forecast) : values[values.length - 1];
  },
  checks: () => {
    const { results, check } = checker();
    const tool = installed("longMemory");
    const steady = madeUpSeries(Array.from({ length: 30 }, () => -70));
    const rising = madeUpSeries(Array.from({ length: 30 }, (_, index) => -90 + index));
    const fitOn = (series: Series) => longMemory.fit?.({ series, from: 0, end: series.points.length, tool, seed: 1 });
    const guessOn = (series: Series, params: unknown) =>
      longMemory.guess({ series, end: series.points.length, targetSol: series.points.length + 1, tool, params });

    check("fit() returns plain JSON that survives a round trip", () => {
      const params = fitOn(rising);
      return JSON.stringify(plain(params)) === JSON.stringify(params) ? true : "params changed in a JSON round trip";
    });
    check("guess() copes with missing or broken params", () => {
      for (const params of [null, "old save", [0.5, 0.1], { alpha: -1, beta: 9 }, { alpha: "0.5", beta: 0.1 }]) {
        const guess = guessOn(rising, params);
        if (guess === null || !Number.isFinite(guess)) return `params ${JSON.stringify(params)}: got ${guess}`;
      }
      return true;
    });
    check("a flat series keeps the default constants and guesses its value", () => {
      const params = plain(fitOn(steady));
      const guess = guessOn(steady, params);
      if (JSON.stringify(params) !== JSON.stringify(DEFAULTS)) return `fit() chose ${JSON.stringify(params)}`;
      return guess !== null && Math.abs(guess + 70) < 1e-9 ? true : `got ${guess}`;
    });
    check("a steadily rising series guesses above the last reading", () => {
      const guess = guessOn(rising, plain(fitOn(rising)));
      return guess !== null && guess > -61 ? true : `got ${guess}, last reading was -61`;
    });
    return results;
  },
};
