import { DataCredits } from "@/components/data-credits";
import { marsWeather, spaceWeather } from "@/lib/nasa/snapshot";

// Placeholder home page. It proves the real NASA data is wired in; replace it with the game.

export default function Home() {
  const latestSol = marsWeather.sols.at(-1);
  const strongestStorm = spaceWeather.gst.reduce<number | null>(
    (max, storm) => (storm.maxKp !== null && (max === null || storm.maxKp > max) ? storm.maxKp : max),
    null,
  );

  const stats = [
    {
      value: spaceWeather.cme.length,
      label: "solar eruptions",
      detail: `Coronal mass ejections, ${spaceWeather.range.start} to ${spaceWeather.range.end}`,
    },
    {
      value: spaceWeather.gst.length,
      label: "geomagnetic storms",
      detail: strongestStorm === null ? "None in this window" : `Strongest reached Kp ${strongestStorm} (scale 0 to 9)`,
    },
    {
      value: spaceWeather.sep.length,
      label: "radiation storms",
      detail: "Solar energetic particle events, the kind a crew shelters from",
    },
    {
      value: marsWeather.sols.length,
      label: "Mars days of weather",
      detail: latestSol
        ? `Latest: sol ${latestSol.sol}, ${latestSol.minTempC} to ${latestSol.maxTempC} °C, ${latestSol.pressurePa} Pa`
        : "No sols loaded",
    },
  ];

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-white/50">
            2026 NASA Space Apps Challenge · Junior Astronaut Mission Trainer
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Project starter</h1>
          <p className="max-w-2xl text-white/70">
            The project is not chosen yet. This page shows that real NASA data is loaded and ready to build on.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-4xl tabular-nums">{stat.value.toLocaleString("en-US")}</p>
              <p className="mt-1 font-medium">{stat.label}</p>
              <p className="mt-2 text-sm text-white/60">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3 text-sm text-white/70">
          <h2 className="text-base font-medium text-white">Where to start</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Build the game in <code className="font-mono text-white">src/app/page.tsx</code>.
            </li>
            <li>
              Real data comes from <code className="font-mono text-white">src/lib/nasa/snapshot.ts</code>; refresh it
              with <code className="font-mono text-white">npm run data:fetch</code>.
            </li>
            <li>
              Seeded randomness for replayable missions is in{" "}
              <code className="font-mono text-white">src/lib/rng.ts</code>.
            </li>
            <li>
              The submission checklist and deadline are in <code className="font-mono text-white">SUBMISSION.md</code>.
            </li>
          </ul>
        </section>
      </main>
      <DataCredits />
    </>
  );
}
