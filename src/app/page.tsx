import { DataCredits } from "@/components/data-credits";
import { HomeHero } from "@/components/home-hero";
import { Icon, type IconName } from "@/components/icons";
import { NavLink, SiteNav } from "@/components/site-nav";
import { marsWeather } from "@/lib/nasa/snapshot";

const STEPS: { icon: IconName; tone: string; title: string; text: string }[] = [
  {
    icon: "sun",
    tone: "text-sun",
    title: "Read the sky",
    text: "The Curiosity rover measured how much sunlight reached the ground. That sets your solar power.",
  },
  {
    icon: "bolt",
    tone: "text-battery",
    title: "Plan your power",
    text: "Spend energy growing air and food, or save it in the battery for the night.",
  },
  {
    icon: "moon",
    tone: "text-ink",
    title: "Face the night",
    text: "Then the rover's real overnight low is revealed, and you see if your plan held.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav
        right={
          <>
            <NavLink href="/mission">Missions</NavLink>
            <NavLink href="/how-it-works">How it works</NavLink>
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
        <HomeHero solCount={marsWeather.sols.length} />
        <section className="grid gap-4 md:grid-cols-3" aria-label="How a sol works">
          {STEPS.map((step) => (
            <div key={step.title} className="card flex gap-4 p-5 sm:p-6">
              <Icon name={step.icon} size={28} strokeWidth={1.8} className={`flex-none ${step.tone}`} />
              <div className="border-l border-line pl-4">
                <h2 className="text-xl">{step.title}</h2>
                <p className="mt-1 text-ink-2">{step.text}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
      <DataCredits />
    </>
  );
}
