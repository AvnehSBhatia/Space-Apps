// Advanced Lab tool. NOT BUILT YET: until it is, it behaves as Copycat and `ready` is false.
// See docs/PART-A-BRAIN.md for what it should do.

import { recent, type ToolModule } from "../core";

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
    ready: false,
  },
  guess: ({ series, end }) => recent(series.points, end, 1)[0] ?? null,
};
