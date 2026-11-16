import { recent, type ToolModule } from "../core";

export const copycat: ToolModule = {
  info: {
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
  guess: ({ series, end }) => recent(series.points, end, 1)[0] ?? null,
};
