// A hit-or-miss row for one tool, for the Brain Bay: "right 9 of the last 10 sols".
// The UI may import this directly: `import { scoreboard } from "@/brain/scoreboard"`.

import type { SolReading, Target, ToolInstance } from "../contracts";
import { brain } from "./index";

/** A guess counts as a hit within 2 C for the night low, or on the exact level for sunlight. */
export const HIT_WITHIN: Record<Target, number> = { nightLowC: 2, sunlight: 0.5 };

export type Scoreboard = {
  /** One entry per sol, oldest first. null means the rover sent no reading that sol. */
  marks: { sol: number; hit: boolean | null }[];
  hits: number;
  /** Sols that had a reading. */
  played: number;
};

export function scoreboard(tool: ToolInstance, history: SolReading[], target: Target, lastSols = 10): Scoreboard {
  const marks = brain.preview(tool, history, target, lastSols).map((point) => ({
    sol: point.sol,
    hit:
      point.actual === null || point.guess === null
        ? null
        : Math.abs(point.guess - point.actual) <= HIT_WITHIN[target],
  }));
  const played = marks.filter((mark) => mark.hit !== null);
  return { marks, hits: played.filter((mark) => mark.hit).length, played: played.length };
}
