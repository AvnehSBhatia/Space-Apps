// A hit-or-miss row for one tool, for the Brain Bay: "right 9 of the last 10 sols".
// The UI may import this directly: `import { scoreboard } from "@/brain/scoreboard"`.

import type { SolReading, Target, ToolInstance } from "../contracts";
import { brain } from "./index";

/** How close a guess must be to count as a hit: within 2 C for the night low, within half a level for sunlight. */
export const HIT_WITHIN: Record<Target, number> = { nightLowC: 2, sunlight: 0.5 };

/** Sunlight is a hit only when the guess rounds to the real level, so a guess of 2.5 is not a hit for both 2 and 3. */
const isHit = (guess: number, actual: number, target: Target) =>
  target === "sunlight" ? Math.round(guess) === actual : Math.abs(guess - actual) <= HIT_WITHIN[target];

export type Scoreboard = {
  /** One entry per sol, oldest first. null means the rover sent no reading that sol, or the tool had no guess. */
  marks: { sol: number; hit: boolean | null }[];
  hits: number;
  /** Sols that could be marked. */
  played: number;
};

export function scoreboard(tool: ToolInstance, history: SolReading[], target: Target, lastSols = 10): Scoreboard {
  const marks = brain.preview(tool, history, target, lastSols).map((point) => ({
    sol: point.sol,
    hit: point.actual === null || point.guess === null ? null : isHit(point.guess, point.actual, target),
  }));
  const played = marks.filter((mark) => mark.hit !== null);
  return { marks, hits: played.filter((mark) => mark.hit).length, played: played.length };
}
