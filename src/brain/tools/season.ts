import { MARS_YEAR_SOLS, recent, type ToolModule } from "../core";

export const season: ToolModule = {
  info: {
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
  guess: ({ series, end, targetSol }) => {
    // The same sol one Mars year earlier, or its nearest neighbour if the rover sent nothing that sol.
    for (const offset of [0, 1, -1, 2, -2]) {
      const value = series.bySol.get(targetSol - MARS_YEAR_SOLS + offset);
      if (value !== null && value !== undefined) return value;
    }
    return recent(series.points, end, 1)[0] ?? null;
  },
};
