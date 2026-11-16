// Seeded random numbers, so a mission can be replayed or shared by its seed.
// Math.random() cannot be seeded; use this for anything that should vary between
// playthroughs but stay the same for one seed.

export type Rng = {
  /** Float in [0, 1). */
  next: () => number;
  /** Integer from min to max, both included. */
  int: (min: number, max: number) => number;
  /** One item from a non-empty list. */
  pick: <T>(items: readonly T[]) => T;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  // mulberry32
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)];
  return { next, int, pick };
}

/** Turns any text (a mission name, a date) into a seed. */
export function seedFromText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
