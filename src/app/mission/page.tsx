"use client";

import dynamic from "next/dynamic";

// The game reads the saved game and the URL on start, so it renders only in the browser.
const MissionApp = dynamic(() => import("@/components/mission-app").then((m) => m.MissionApp), {
  ssr: false,
  loading: () => <p className="p-8 text-center font-display text-2xl">Warming up the outpost…</p>,
});

export default function MissionPage() {
  return <MissionApp />;
}
