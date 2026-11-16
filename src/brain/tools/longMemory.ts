// Advanced Lab tool. NOT BUILT YET: until it is, it behaves as Copycat and `ready` is false.
// See docs/PART-A-BRAIN.md for what it should do.

import { recent, type ToolModule } from "../core";

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
    ready: false,
  },
  guess: ({ series, end }) => recent(series.points, end, 1)[0] ?? null,
};
