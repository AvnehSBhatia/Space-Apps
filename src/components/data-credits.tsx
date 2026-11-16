import { marsWeather, spaceWeather } from "@/lib/nasa/snapshot";

const day = (iso: string) => iso.slice(0, 10);

/**
 * Data attribution. The challenge asks for sources to be credited inside the tool,
 * and for archived data never to be presented as live. Keep this on every screen.
 */
export function DataCredits() {
  return (
    <footer className="mt-auto border-t border-line px-4 py-6 text-sm leading-relaxed text-ink-2 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p>
          Mars weather: Curiosity rover REMS station, sols {marsWeather.range.firstSol} to {marsWeather.range.lastSol} (
          {marsWeather.credit}). Space weather: NASA DONKI, {spaceWeather.range.start} to {spaceWeather.range.end}. Archived
          data saved on {day(spaceWeather.fetchedAt)}; it is real, not live.
        </p>
        <p className="mt-1">
          Illustrations are AI-generated. Built for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by NASA.
        </p>
      </div>
    </footer>
  );
}
