// The Curiosity weather record in the shape the brain and the game use (see src/contracts).

import type { SolReading } from "../../contracts";
import { marsWeather } from "./snapshot";

function hoursBetween(sunrise: string | null, sunset: string | null): number | null {
  if (!sunrise || !sunset) return null;
  const [riseHour, riseMinute] = sunrise.split(":").map(Number);
  const [setHour, setMinute] = sunset.split(":").map(Number);
  const hours = setHour + setMinute / 60 - (riseHour + riseMinute / 60);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 100) / 100 : null;
}

let cache: SolReading[] | null = null;

/** Every sol in the archive, oldest first. Some sols are missing and some readings are null. */
export function allReadings(): SolReading[] {
  if (!cache) {
    cache = marsWeather.sols.map((sol) => ({
      sol: sol.sol,
      earthDate: sol.earthDate,
      minTempC: sol.minTempC,
      maxTempC: sol.maxTempC,
      pressurePa: sol.pressurePa,
      uvIndex: sol.uvIndex,
      daylightHours: hoursBetween(sol.sunrise, sol.sunset),
      solarLongitude: sol.solarLongitude,
    }));
  }
  return cache;
}
