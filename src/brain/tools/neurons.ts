// Advanced Lab tool: a tiny neural network. One hidden layer of tanh units learns the next change from
// the last few readings; the change it predicts is added to the newest reading.

import { createRng } from "../../lib/rng";
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
  recent,
  type Series,
  type ToolModule,
} from "../core";

/** The network sees the 4 readings before the newest one, as changes from the newest. */
const INPUTS = 4;
const NEEDED = INPUTS + 1;
/** With fewer worked examples than this, the tool acts as Copycat. */
const MIN_EXAMPLES = 20;
/** Training steps, and how far each step moves the weights. 90 steps keep fit() inside its time limit. */
const STEPS = 90;
const RATE = 0.1;
/** Caps, in typical one-sol changes, so one odd reading cannot throw the network off. */
const INPUT_CAP = 5;
const OUTPUT_CAP = 3;

/** What fit() learns: the typical one-sol change, and the network's weights. */
type Params = { scale: number; w1: number[][]; b1: number[]; w2: number[]; b2: number };

const cap = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));
/** The same as Math.tanh, but about twice as fast. Training calls it tens of thousands of times. */
const tanh = (value: number) => 1 - 2 / (1 + Math.exp(2 * value));

/** The inputs for guessing what follows values[next - 1]: the 4 readings before it, as changes from it. */
function inputsFor(values: number[], next: number, scale: number): number[] {
  const newest = values[next - 1];
  return Array.from({ length: INPUTS }, (_, k) => cap((values[next - NEEDED + k] - newest) / scale, INPUT_CAP));
}

/** True for a whole set of finite weights. An old save file may hold anything. */
function isParams(params: unknown): params is Params {
  if (typeof params !== "object" || params === null) return false;
  const { scale, w1, b1, w2, b2 } = params as Record<string, unknown>;
  if (!isNumber(scale) || scale <= 0 || !isNumber(b2)) return false;
  if (!Array.isArray(w1) || !Array.isArray(b1) || !Array.isArray(w2)) return false;
  const units = w1.length;
  return (
    units > 0 &&
    b1.length === units &&
    w2.length === units &&
    w1.every((row) => Array.isArray(row) && row.length === INPUTS && row.every(isNumber)) &&
    b1.every(isNumber) &&
    w2.every(isNumber)
  );
}

/** The network's predicted next change, in typical changes. */
function forward(params: Params, inputs: number[]): number {
  let out = params.b2;
  params.w1.forEach((row, unit) => {
    let sum = params.b1[unit];
    for (let k = 0; k < INPUTS; k += 1) sum += row[k] * inputs[k];
    out += params.w2[unit] * tanh(sum);
  });
  return cap(out, OUTPUT_CAP);
}

export const neurons: ToolModule = {
  info: {
    id: "neurons",
    name: "Neuron Pack",
    realName: "neural network",
    blurb: "A small network of adjustable knobs that learns its own rule.",
    energyWhPerSol: 900,
    knobs: [{ key: "neurons", label: "Neurons", min: 2, max: 16, step: 1, initial: 4 }],
    learns: true,
    advanced: true,
    ready: true,
  },
  fit: ({ series, from, end, tool, seed }) => {
    const values = readings(series.points, Math.max(from, end - TRAIN_WINDOW), end);
    const count = values.length - NEEDED;
    if (count < MIN_EXAMPLES) return null;
    const units = knobOf(neurons.info, tool, "neurons");

    // How much a reading typically changes from one sol to the next.
    const changes = values.slice(1).map((value, index) => value - values[index]);
    const average = mean(changes);
    const spread = Math.sqrt(mean(changes.map((change) => (change - average) ** 2)));
    if (!Number.isFinite(spread)) return null;
    const scale = Math.max(1e-6, spread);

    // One worked example for each reading with 5 readings before it: those inputs, and the change that came next.
    const xs = new Float64Array(count * INPUTS);
    const ys = new Float64Array(count);
    for (let n = 0; n < count; n += 1) {
      const next = n + NEEDED;
      xs.set(inputsFor(values, next, scale), n * INPUTS);
      ys[n] = cap((values[next] - values[next - 1]) / scale, OUTPUT_CAP);
    }

    // Small random starting weights, the same for the same seed.
    const rng = createRng(seed);
    const w1 = Float64Array.from({ length: units * INPUTS }, () => rng.next() * 0.6 - 0.3);
    const w2 = Float64Array.from({ length: units }, () => rng.next() * 0.6 - 0.3);
    const b1 = new Float64Array(units);
    let b2 = 0;

    // Full-batch gradient descent on the mean squared error of the predicted change.
    const g1 = new Float64Array(units * INPUTS);
    const gb1 = new Float64Array(units);
    const g2 = new Float64Array(units);
    const act = new Float64Array(units);
    for (let step = 0; step < STEPS; step += 1) {
      g1.fill(0);
      gb1.fill(0);
      g2.fill(0);
      let gb2 = 0;
      for (let n = 0; n < count; n += 1) {
        // Written out for the 4 inputs: this loop is where nearly all the time goes.
        const x0 = xs[n * INPUTS];
        const x1 = xs[n * INPUTS + 1];
        const x2 = xs[n * INPUTS + 2];
        const x3 = xs[n * INPUTS + 3];
        let out = b2;
        for (let unit = 0, w = 0; unit < units; unit += 1, w += INPUTS) {
          act[unit] = tanh(b1[unit] + w1[w] * x0 + w1[w + 1] * x1 + w1[w + 2] * x2 + w1[w + 3] * x3);
          out += w2[unit] * act[unit];
        }
        const err = (2 * (out - ys[n])) / count;
        gb2 += err;
        for (let unit = 0, w = 0; unit < units; unit += 1, w += INPUTS) {
          g2[unit] += err * act[unit];
          const back = err * w2[unit] * (1 - act[unit] * act[unit]);
          gb1[unit] += back;
          g1[w] += back * x0;
          g1[w + 1] += back * x1;
          g1[w + 2] += back * x2;
          g1[w + 3] += back * x3;
        }
      }
      for (let index = 0; index < w1.length; index += 1) w1[index] -= RATE * g1[index];
      for (let unit = 0; unit < units; unit += 1) {
        b1[unit] -= RATE * gb1[unit];
        w2[unit] -= RATE * g2[unit];
      }
      b2 -= RATE * gb2;
    }

    const params: Params = {
      scale,
      w1: Array.from({ length: units }, (_, unit) => Array.from(w1.subarray(unit * INPUTS, (unit + 1) * INPUTS))),
      b1: Array.from(b1),
      w2: Array.from(w2),
      b2,
    };
    // If training ever blew up, learn nothing rather than save broken weights.
    return isParams(params) ? params : null;
  },
  guess: ({ series, end, params }) => {
    const latest = recent(series.points, end, NEEDED).reverse();
    if (latest.length === 0) return null;
    const newest = latest[latest.length - 1];
    if (latest.length < NEEDED || !isParams(params)) return newest;
    const guess = newest + forward(params, inputsFor(latest, NEEDED, params.scale)) * params.scale;
    return Number.isFinite(guess) ? guess : newest;
  },
  checks: () => {
    const { results, check } = checker();
    const tool = installed("neurons");
    const fitOn = (series: Series, seed = 1) => neurons.fit?.({ series, from: 0, end: series.points.length, tool, seed });
    const guessOn = (series: Series, params: unknown) =>
      neurons.guess({ series, end: series.points.length, targetSol: series.points.length + 1, tool, params });
    const wavy = madeUpSeries(Array.from({ length: 80 }, (_, index) => -70 + 5 * Math.sin(index / 3) + (index % 4)));
    const newest = wavy.points[wavy.points.length - 1].value;

    check("fit() returns plain JSON that survives a round trip", () => {
      const params = fitOn(wavy);
      if (params === null) return "fit returned null on 80 readings";
      return JSON.stringify(plain(params)) === JSON.stringify(params) ? true : "params changed in a JSON round trip";
    });
    check("same seed gives the same weights", () =>
      JSON.stringify(fitOn(wavy, 7)) === JSON.stringify(fitOn(wavy, 7)) ? true : "two fits differ",
    );
    check("with no weights, or broken ones from an old save, it acts as Copycat", () => {
      const wrongShape = { scale: 1, w1: [[1, 2]], b1: [0], w2: [1], b2: 0 };
      const broken = [null, 3, "weights", {}, wrongShape, { ...(fitOn(wavy) as object), scale: -1 }];
      const bad = broken.findIndex((params) => guessOn(wavy, params) !== newest);
      return bad === -1 ? true : `params ${JSON.stringify(broken[bad])} gave ${guessOn(wavy, broken[bad])}`;
    });
    check("on a perfectly steady series the guess equals that value", () => {
      const steady = madeUpSeries(Array.from({ length: 60 }, () => -75));
      const guess = guessOn(steady, plain(fitOn(steady)));
      return guess !== null && Math.abs(guess + 75) < 1e-6 ? true : `got ${guess}`;
    });
    check("it really learns: on a zigzag it guesses the next turn, which Copycat cannot", () => {
      // Up 2, down 2, up 2...: the next reading is the one before the newest.
      const zigzag = madeUpSeries(Array.from({ length: 80 }, (_, index) => (index % 2 === 0 ? -69 : -71)));
      const guess = guessOn(zigzag, plain(fitOn(zigzag)));
      return guess !== null && Math.abs(guess + 69) < 0.5 ? true : `guessed ${guess}, the truth is -69, Copycat says -71`;
    });
    return results;
  },
};
