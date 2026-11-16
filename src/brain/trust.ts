// How much the brain trusts each tool.

/** One training sol: what really happened, and what each tool guessed (null when a tool had nothing to go on). */
export type TrustRow = { actual: number; guesses: (number | null)[] };

/**
 * Added to every tool's mean squared miss, so a tool that has been exactly right
 * neither divides by zero nor takes all the trust.
 */
const MISS_FLOOR = 0.05;

/**
 * Weights for blending the tools, one per tool, each 0 or more, summing to 1.
 * The rows are sols the tools had not learned from, so a tool cannot earn trust by memorising.
 *
 * Each tool is trusted in proportion to 1 / (its mean squared miss). Weights fitted by least squares were
 * tried instead and made the core tools' night-low blend worse, so this simpler rule stayed.
 */
export function learnTrust(rows: TrustRow[], toolCount: number): number[] {
  if (toolCount === 0) return [];
  const squared = new Array<number>(toolCount).fill(0);
  const counts = new Array<number>(toolCount).fill(0);
  for (const row of rows) {
    row.guesses.forEach((guess, index) => {
      if (guess !== null) {
        squared[index] += (guess - row.actual) ** 2;
        counts[index] += 1;
      }
    });
  }
  const raw = squared.map((sum, index) => (counts[index] > 0 ? 1 / (sum / counts[index] + MISS_FLOOR) : 0));
  const total = raw.reduce((sum, value) => sum + value, 0);
  return total > 0 ? raw.map((value) => value / total) : raw.map(() => 1 / toolCount);
}

/** The blended guess. Tools with no guess are left out and the rest are re-weighted. */
export function blend(guesses: (number | null)[], trust: number[]): number | null {
  let total = 0;
  let weight = 0;
  guesses.forEach((guess, index) => {
    if (guess !== null) {
      total += guess * trust[index];
      weight += trust[index];
    }
  });
  return weight > 0 ? total / weight : null;
}
