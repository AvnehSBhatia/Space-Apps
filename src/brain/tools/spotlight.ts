// Advanced Lab tool. NOT BUILT YET: until it is, it behaves as Copycat and `ready` is false.
// See docs/PART-A-BRAIN.md for what it should do.

import { recent, type ToolModule } from "../core";

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
    ready: false,
  },
  guess: ({ series, end }) => recent(series.points, end, 1)[0] ?? null,
};
