// How wide the brain's forecast range is.

import type { Target } from "../contracts";
import { isNumber } from "./core";

/** Offsets added to a forecast to get its low and high ends. low <= 0 <= high. */
export type Range = { low: number; high: number };

/** The range used when there are too few misses to learn one from. */
const fallback = (target: Target): Range => (target === "nightLowC" ? { low: -4, high: 4 } : { low: -1, high: 1 });

/** The least each side may reach, so a lucky quiet stretch cannot make the night-low range too thin. */
const minSide = (target: Target) => (target === "nightLowC" ? 0.5 : 0);

/** The k-th smallest value (1-based), with k clamped to the ends. */
function kth(sorted: number[], k: number): number {
  return sorted[Math.min(sorted.length, Math.max(1, k)) - 1];
}

/**
 * The range the truth should fall in 8 times out of 10, from the brain's recent misses
 * (each miss is truth minus guess, on sols the tools had not learned from).
 */
export function learnRange(misses: number[], target: Target): Range {
  if (misses.length < 10) return fallback(target);
  const sorted = [...misses].sort((a, b) => a - b);
  // Conformal levels: for n misses, the floor((n + 1) * 0.1)-th and ceil((n + 1) * 0.9)-th smallest.
  const n = sorted.length;
  const low = kth(sorted, Math.floor((n + 1) * 0.1));
  const high = kth(sorted, Math.ceil((n + 1) * 0.9));
  // The side limits also keep low <= 0 <= high when every recent miss had the same sign.
  return { low: Math.min(low, -minSide(target)), high: Math.max(high, minSide(target)) };
}

/** Reads a saved range back safely. */
export function readRange(saved: unknown, target: Target): Range {
  const candidate = saved as Partial<Range> | null;
  return candidate && isNumber(candidate.low) && isNumber(candidate.high)
    ? { low: candidate.low, high: candidate.high }
    : fallback(target);
}
