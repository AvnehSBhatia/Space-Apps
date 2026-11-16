// Archived NASA data, saved by `npm run data:fetch` into src/data/.
// Import from here in game code. Everything is real, recorded data; none of it is live.

import cmeFile from "../../data/donki-cme.json";
import gstFile from "../../data/donki-gst.json";
import sepFile from "../../data/donki-sep.json";
import marsFile from "../../data/mars-weather-curiosity.json";

/** Coronal mass ejection: a cloud of charged gas thrown off the Sun. */
export type CmeEvent = {
  id: string | null;
  startTime: string | null;
  sourceLocation: string | null;
  speedKmS: number | null;
  halfAngleDeg: number | null;
  speedClass: string | null;
  note: string | null;
  link: string | null;
};

/** Geomagnetic storm. Kp runs 0 to 9; 5 and above is a storm. */
export type GstEvent = {
  id: string | null;
  startTime: string | null;
  maxKp: number | null;
  kp: { observedTime: string | null; kpIndex: number | null }[];
  link: string | null;
};

/** Solar energetic particle event: the radiation storm astronauts shelter from. */
export type SepEvent = {
  id: string | null;
  eventTime: string | null;
  instruments: string[];
  link: string | null;
};

/** One Martian day of weather at Gale Crater, measured by the Curiosity rover. */
export type MarsSol = {
  sol: number;
  earthDate: string | null;
  season: string | null;
  minTempC: number | null;
  maxTempC: number | null;
  pressurePa: number | null;
  /** The rover's measured ultraviolet index: how much sunlight reached the ground. */
  uvIndex: "Low" | "Moderate" | "High" | "Very_High" | null;
  /** Solar longitude, 0 to 360: where Mars is in its year. */
  solarLongitude: number | null;
  sunrise: string | null;
  sunset: string | null;
};

export const spaceWeather = {
  fetchedAt: cmeFile.fetchedAt,
  range: cmeFile.range,
  cme: cmeFile.events as unknown as CmeEvent[],
  gst: gstFile.events as unknown as GstEvent[],
  sep: sepFile.events as unknown as SepEvent[],
};

export const marsWeather = {
  fetchedAt: marsFile.fetchedAt,
  credit: marsFile.credit,
  range: marsFile.range,
  sols: marsFile.sols as unknown as MarsSol[],
};
