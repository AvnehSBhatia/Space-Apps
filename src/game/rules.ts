// Every number the game uses that is not a NASA measurement lives here, so Part C can tune the game in
// one place and the "How it works" page can show each one. Change a value here and nowhere else.

import type { UvIndex } from "../contracts";

export const RULES = {
  /** A Mars day in hours. Physics. */
  SOL_HOURS: 24.66,
  /** Temperature kept inside the habitat, degrees C. */
  INSIDE_C: 20,

  /**
   * Energy the solar panels collect in one sol, by the rover's measured ultraviolet index.
   * The index is a NASA measurement; the watt-hours for each level are a game rule.
   */
  SOLAR_WH: { Very_High: 27_000, High: 24_000, Moderate: 20_000, Low: 7_000 } satisfies Record<UvIndex, number>,

  BATTERY_CAPACITY_WH: 30_000,
  START_BATTERY_WH: 15_000,

  /** Night power that does not depend on the cold: fans, air scrubbers, computers. */
  KEEP_ALIVE_BASE_WH: 3_500,
  /** Extra night power for each degree the outside is colder than the inside. */
  HEAT_WH_PER_DEGREE: 90,
  /** Huddle: one room instead of the whole habitat. */
  HUDDLE_FACTOR: 0.45,

  GREENHOUSE_MAX_WH: 12_000,
  /** Air the crew uses each sol, in points out of 100. */
  AIR_USE_PER_SOL: 10,
  /** Air made per watt-hour of greenhouse light (recycler plus plants). */
  AIR_PER_WH: 0.002,
  START_AIR: 80,
  /** Below this the crew starts to suffer. */
  AIR_WARNING: 30,

  /** Light a crop needs before it can be harvested. */
  CROP_NEEDS_WH: 60_000,
  /** A crop that gets less light than this in a sol is starved. Two starved sols in a row kill it. */
  CROP_MIN_WH: 2_000,
  HARVEST_MEALS: 40,
  MEALS_PER_SOL: 4,
  /**
   * Nine sols of food: enough to reach the first harvest, which takes about eight sols of light, but not
   * enough for a player who never lights the greenhouse to finish the calm mission.
   */
  START_MEALS: 36,

  /** The careful commander plans for a night this many degrees colder than the last one. */
  CAREFUL_MARGIN_C: 3,

  START_HEALTH: 100,
  HEALTH_PER_COLD_HOUR: 4,
  HEALTH_COLD_CAP: 40,
  HEALTH_PER_AIR_POINT: 0.5,
  HEALTH_HUNGRY: 4,
  HEALTH_RECOVER: 3,
} as const;

/** Night energy needed at a given overnight low. */
export function keepAliveWh(nightLowC: number, huddle: boolean): number {
  const whole = RULES.KEEP_ALIVE_BASE_WH + RULES.HEAT_WH_PER_DEGREE * Math.max(0, RULES.INSIDE_C - nightLowC);
  return Math.round(huddle ? whole * RULES.HUDDLE_FACTOR : whole);
}

/** The coldest night a battery can cover. */
export function coveredDownToC(batteryWh: number, huddle: boolean): number {
  const whole = huddle ? batteryWh / RULES.HUDDLE_FACTOR : batteryWh;
  return Math.round(RULES.INSIDE_C - (whole - RULES.KEEP_ALIVE_BASE_WH) / RULES.HEAT_WH_PER_DEGREE);
}
