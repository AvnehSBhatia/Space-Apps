// How wide the brain's forecast range is.

import type { Target } from "../contracts";

/** Offsets added to a forecast to get its low and high ends. low <= 0 <= high. */
export type Range = { low: number; high: number };

const fallback = (target: Target): Range => (target === "nightLowC" ? { low: -4, high: 4 } : { low: -1, high: 1 });

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * The range the truth should fall in 8 times out of 10, from the brain's recent misses
 * (each miss is truth minus guess, on sols the tools had not learned from).
 */
export function learnRange(misses: number[], target: Target): Range {
  if (misses.length < 10) return fallback(target);
  const sorted = [...misses].sort((a, b) => a - b);
  return { low: Math.min(quantile(sorted, 0.1), 0), high: Math.max(quantile(sorted, 0.9), 0) };
}

/** Reads a saved range back safely. */
export function readRange(saved: unknown, target: Target): Range {
  const candidate = saved as Partial<Range> | null;
  const ok = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  return candidate && ok(candidate.low) && ok(candidate.high) ? { low: candidate.low, high: candidate.high } : fallback(target);
}
