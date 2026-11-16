// Live access to NASA DONKI, the space weather event database.
// Use this on the server only (route handlers, scripts) so the API key stays private.
// For gameplay, prefer the archived snapshot in src/lib/nasa/snapshot.ts: it is instant
// and cannot be rate limited in front of a judge.

export const DONKI_TYPES = ["CME", "GST", "SEP", "FLR"] as const;
export type DonkiType = (typeof DONKI_TYPES)[number];

export function isDonkiType(value: string): value is DonkiType {
  return (DONKI_TYPES as readonly string[]).includes(value);
}

const DAY_MS = 86_400_000;
// DONKI rejects ranges longer than 60 days (checked 2026-11-15).
const WINDOW_DAYS = 55;

export type DateWindow = { start: string; end: string };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Splits an inclusive YYYY-MM-DD range into windows DONKI will accept. */
export function splitDateRange(start: string, end: string, windowDays = WINDOW_DAYS): DateWindow[] {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
    throw new Error(`Bad date range: ${start} to ${end}`);
  }
  const windows: DateWindow[] = [];
  let cursor = from;
  while (cursor <= to) {
    const windowEnd = Math.min(cursor + windowDays * DAY_MS, to);
    windows.push({ start: isoDate(new Date(cursor)), end: isoDate(new Date(windowEnd)) });
    cursor = windowEnd + DAY_MS;
  }
  return windows;
}

/** Raw DONKI events for a date range. The shape differs per type; see https://api.nasa.gov (DONKI). */
export async function fetchDonki(
  type: DonkiType,
  start: string,
  end: string,
  apiKey: string = process.env.NASA_API_KEY || "DEMO_KEY",
): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = [];
  for (const window of splitDateRange(start, end)) {
    const url = `https://api.nasa.gov/DONKI/${type}?startDate=${window.start}&endDate=${window.end}&api_key=${apiKey}`;
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`DONKI ${type} returned HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (text.trim() === "") continue;
    const body: unknown = JSON.parse(text);
    if (!Array.isArray(body)) {
      throw new Error(`DONKI ${type} returned an unexpected response: ${text.slice(0, 200)}`);
    }
    events.push(...(body as Record<string, unknown>[]));
  }
  return events;
}
