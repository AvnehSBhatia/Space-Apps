import { knobOf, mean, recent, type ToolModule } from "../core";

export const averager: ToolModule = {
  info: {
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
  guess: ({ series, end, tool }) => {
    const values = recent(series.points, end, knobOf(averager.info, tool, "sols"));
    return values.length > 0 ? mean(values) : null;
  },
};
