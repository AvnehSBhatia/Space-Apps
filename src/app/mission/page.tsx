"use client";

import dynamic from "next/dynamic";

// The game reads the saved game and the URL on start, so it renders only in the browser.
const MissionApp = dynamic(() => import("@/components/mission-app").then((m) => m.MissionApp), {
  ssr: false,
  loading: () => <p className="p-10 text-center text-xl text-ink-2">Loading the outpost…</p>,
});

export default function MissionPage() {
  return <MissionApp />;
}
