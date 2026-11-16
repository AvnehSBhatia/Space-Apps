import { knobOf, mean, recent, type ToolModule } from "../core";

export const trend: ToolModule = {
  info: {
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
  guess: ({ series, end, tool }) => {
    const values = recent(series.points, end, knobOf(trend.info, tool, "sols")).reverse();
    if (values.length === 0) return null;
    if (values.length < 3) return values[values.length - 1];
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
    return Math.min(high + (high - low), Math.max(low - (high - low), guess));
  },
};
