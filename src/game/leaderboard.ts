// Part C: the leaderboard, kept in this browser's localStorage. An online board is later.
//
// Players may be children, so the board never stores a real name: each player gets a generated call sign.
// A class shares a mission code, `<missionId>-<seed>`, so everyone plays the same real sols.

import type { GameState, LeaderboardApi, LeaderboardEntry, MissionId } from "../contracts";
import { createRng } from "../lib/rng";

const STORAGE_KEY = "solcast.leaderboard.v1";
const MAX_ENTRIES = 200;

const FIRST = ["Brave", "Bright", "Calm", "Clever", "Dusty", "Happy", "Lucky", "Quick", "Steady", "Swift", "Sunny", "Bold"];
const SECOND = ["Comet", "Rover", "Crater", "Orbit", "Nebula", "Meteor", "Pulsar", "Quasar", "Moon", "Star", "Rocket", "Dune"];

/** A friendly call sign such as "Brave Comet 42", from any seed. Two friendly words and a number. */
export function makeCallSign(seed: number): string {
  const rng = createRng(seed);
  return `${rng.pick(FIRST)} ${rng.pick(SECOND)} ${rng.int(10, 99)}`;
}

const MISSION_IDS: MissionId[] = ["calm2016", "conjunction2019", "dust2018"];

/** The code a class shares to play the same mission: `<missionId>-<seed>`. */
export function missionCode(state: Pick<GameState, "mission" | "seed">): string {
  return `${state.mission.id}-${state.seed}`;
}

/** Reads a typed mission code. Returns null if it is not one. Case and spaces do not matter. */
export function parseMissionCode(text: string): { missionId: MissionId; seed: number } | null {
  const match = /^\s*([a-z0-9]+)-(\d{1,9})\s*$/i.exec(text);
  if (!match) return null;
  const missionId = MISSION_IDS.find((id) => id.toLowerCase() === match[1].toLowerCase());
  return missionId ? { missionId, seed: Number(match[2]) } : null;
}

/** The entry for a finished game. The UI supplies the call sign and, for a class, the class code. */
export function entryFor(state: GameState, callSign: string, classCode: string | null, at: string): LeaderboardEntry {
  return {
    callSign,
    missionId: state.mission.id,
    seed: state.seed,
    score: state.score.total,
    crewHealth: state.score.crewHealth,
    mealsHarvested: state.score.mealsHarvested,
    toolsUsed: [...new Set(state.design.tools.map((tool) => tool.id))],
    classCode,
    at,
  };
}

function isEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.callSign === "string" &&
    typeof entry.missionId === "string" &&
    typeof entry.seed === "number" &&
    typeof entry.score === "number" &&
    typeof entry.at === "string"
  );
}

function load(): LeaderboardEntry[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function save(entries: LeaderboardEntry[]): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Private windows and full storage: the board just does not remember.
  }
}

/** Best score first; ties go to the healthier crew, then to whoever finished first. */
function better(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || b.crewHealth - a.crewHealth || a.at.localeCompare(b.at);
}

export const leaderboard: LeaderboardApi = {
  async submit(entry) {
    if (!isEntry(entry)) return;
    save([...load(), entry]);
  },
  async top(missionId, seed, classCode, limit) {
    return load()
      .filter((entry) => entry.missionId === missionId && entry.seed === seed)
      .filter((entry) => classCode === null || entry.classCode === classCode)
      .sort(better)
      .slice(0, Math.max(0, limit));
  },
};
