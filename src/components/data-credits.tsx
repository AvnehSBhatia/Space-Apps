import { marsWeather, spaceWeather } from "@/lib/nasa/snapshot";

const day = (iso: string) => iso.slice(0, 10);

/**
 * Data attribution. The challenge asks for sources to be credited inside the tool,
 * and for archived data never to be presented as live. Keep this on every screen.
 */
export function DataCredits() {
  return (
    <footer className="border-t border-black/10 px-6 py-6 text-xs leading-relaxed text-black/60">
      <p>
        Space weather: NASA DONKI, {spaceWeather.range.start} to {spaceWeather.range.end}. Mars weather:
        Curiosity rover REMS station, sols {marsWeather.range.firstSol} to {marsWeather.range.lastSol} (
        {marsWeather.credit}). Archived data saved on {day(spaceWeather.fetchedAt)}; it is real, not live.
      </p>
      <p className="mt-2">
        Built for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by NASA.
      </p>
    </footer>
  );
}
