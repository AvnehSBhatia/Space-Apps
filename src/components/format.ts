import type { GameState, UvIndex } from "@/contracts";

/** Display helpers only. No game rules live here. */

export const kWh = (wh: number) => `${(wh / 1000).toFixed(1)} kWh`;

export const SUNLIGHT_WORD: Record<UvIndex, string> = {
  Low: "Low",
  Moderate: "Moderate",
  High: "High",
  Very_High: "Very High",
};

export const SUNLIGHT_LEVEL_WORD = ["", "Low", "Moderate", "High", "Very High"];

export function niceDate(iso: string | null): string {
  if (!iso) return "date unknown";
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const SAVE_KEY = "solcast.save.v1";

export function saveGame(state: GameState) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private windows or blocked storage: the game still works, it just cannot continue later.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return parsed && parsed.version === 1 && parsed.mission ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export const missionCode = (state: GameState) => `${state.mission.id}-${state.seed}`;
