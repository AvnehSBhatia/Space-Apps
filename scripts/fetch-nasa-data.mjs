#!/usr/bin/env node
// Saves a snapshot of real NASA data into src/data/ so the app works offline,
// loads instantly, and never hits API rate limits during judging.
//
//   npm run data:fetch              last 55 days of space weather + all Curiosity sols
//   npm run data:fetch -- --days=365
//
// The files it writes are ARCHIVED data. Label them that way in the UI; do not
// present them as live.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src", "data");

for (const name of [".env.local", ".env"]) {
  const file = path.join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}

const API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const DAY_MS = 86_400_000;
// DONKI rejects ranges longer than 60 days, so longer requests are split.
const WINDOW_DAYS = 55;
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const DAYS = daysArg ? Number(daysArg.split("=")[1]) : WINDOW_DAYS;

const isoDate = (date) => date.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end.getTime() - DAYS * DAY_MS);

function splitRange(from, to) {
  const windows = [];
  let cursor = from.getTime();
  while (cursor <= to.getTime()) {
    const windowEnd = Math.min(cursor + WINDOW_DAYS * DAY_MS, to.getTime());
    windows.push({ start: isoDate(new Date(cursor)), end: isoDate(new Date(windowEnd)) });
    cursor = windowEnd + DAY_MS;
  }
  return windows;
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  if (text.trim() === "") return [];
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Not JSON: ${text.slice(0, 200)}`);
  }
}

async function fetchDonki(type) {
  const events = [];
  for (const window of splitRange(start, end)) {
    const url = `https://api.nasa.gov/DONKI/${type}?startDate=${window.start}&endDate=${window.end}&api_key=${API_KEY}`;
    const body = await getJson(url);
    if (!Array.isArray(body)) throw new Error(`Unexpected response: ${JSON.stringify(body).slice(0, 200)}`);
    events.push(...body);
  }
  return events;
}

const slim = {
  CME: (event) => {
    const analyses = event.cmeAnalyses ?? [];
    const best = analyses.find((analysis) => analysis.isMostAccurate) ?? analyses[0] ?? null;
    return {
      id: event.activityID ?? null,
      startTime: event.startTime ?? null,
      sourceLocation: event.sourceLocation || null,
      speedKmS: best?.speed ?? null,
      halfAngleDeg: best?.halfAngle ?? null,
      speedClass: best?.type ?? null,
      note: event.note || null,
      link: event.link ?? null,
    };
  },
  GST: (event) => {
    const kp = (event.allKpIndex ?? []).map((reading) => ({
      observedTime: reading.observedTime ?? null,
      kpIndex: reading.kpIndex ?? null,
    }));
    const values = kp.map((reading) => reading.kpIndex).filter((value) => typeof value === "number");
    return {
      id: event.gstID ?? null,
      startTime: event.startTime ?? null,
      maxKp: values.length ? Math.max(...values) : null,
      kp,
      link: event.link ?? null,
    };
  },
  SEP: (event) => ({
    id: event.sepID ?? null,
    eventTime: event.eventTime ?? null,
    instruments: (event.instruments ?? []).map((instrument) => instrument.displayName),
    link: event.link ?? null,
  }),
};

const donkiNames = {
  CME: "coronal mass ejections",
  GST: "geomagnetic storms",
  SEP: "solar energetic particle events",
};

async function save(name, payload) {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await writeFile(file, `${JSON.stringify(payload, null, 1)}\n`);
  return path.relative(root, file);
}

const toNumber = (value) => {
  const number = Number(value);
  return value === null || value === undefined || value === "" || Number.isNaN(number) ? null : number;
};

let failed = false;
const fetchedAt = new Date().toISOString();

for (const type of Object.keys(slim)) {
  try {
    const events = (await fetchDonki(type)).map(slim[type]);
    const file = await save(`donki-${type.toLowerCase()}.json`, {
      source: "NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)",
      sourceUrl: `https://api.nasa.gov/DONKI/${type}`,
      description: donkiNames[type],
      archived: true,
      fetchedAt,
      range: { start: isoDate(start), end: isoDate(end) },
      events,
    });
    console.log(`${type}: ${events.length} ${donkiNames[type]} -> ${file}`);
  } catch (error) {
    failed = true;
    console.error(`${type}: failed, existing file left as it was. ${error.message}`);
  }
}

try {
  const feed = await getJson("https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json");
  const sols = (feed.soles ?? [])
    .map((sol) => ({
      sol: toNumber(sol.sol),
      earthDate: sol.terrestrial_date ?? null,
      season: sol.season ?? null,
      minTempC: toNumber(sol.min_temp),
      maxTempC: toNumber(sol.max_temp),
      pressurePa: toNumber(sol.pressure),
      sunrise: sol.sunrise ?? null,
      sunset: sol.sunset ?? null,
      sky: sol.atmo_opacity ?? null,
    }))
    .filter((sol) => sol.sol !== null)
    .sort((a, b) => a.sol - b.sol);
  if (sols.length === 0) throw new Error("Feed returned no sols");
  const file = await save("mars-weather-curiosity.json", {
    source: "Curiosity rover REMS weather station, Gale Crater, Mars",
    credit: "NASA/JPL-Caltech/CAB (CSIC-INTA)",
    sourceUrl: "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
    archived: true,
    fetchedAt,
    range: { firstSol: sols[0].sol, lastSol: sols.at(-1).sol, lastEarthDate: sols.at(-1).earthDate },
    sols,
  });
  console.log(`Mars weather: ${sols.length} sols (latest sol ${sols.at(-1).sol}, ${sols.at(-1).earthDate}) -> ${file}`);
} catch (error) {
  failed = true;
  console.error(`Mars weather: failed, existing file left as it was. ${error.message}`);
}

if (API_KEY === "DEMO_KEY") {
  console.log("Used DEMO_KEY (about 10 requests an hour). Get a free key at https://api.nasa.gov and put it in .env.local.");
}
process.exitCode = failed ? 1 : 0;
