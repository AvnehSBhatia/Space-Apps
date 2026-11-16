"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SAVE_KEY } from "./format";
import { Icon } from "./icons";
import { MarsScene } from "./mars-scene";

function hasSave(): boolean {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.phase !== "ended";
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function HomeHero({ solCount }: { solCount: number }) {
  const canContinue = useSyncExternalStore(subscribe, hasSave, () => false);

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
      <div className="flex flex-col gap-6">
        <h1 className="text-[2.7rem] sm:text-[4rem]">Keep a Mars outpost running on real rover weather.</h1>
        <p className="max-w-[34rem] text-xl text-ink-2">
          Each sol, read the sky, plan your power, and see what really happened on Mars that night.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/mission" className="btn btn-primary min-w-40 text-lg">
            <Icon name="play" size={18} filled strokeWidth={0} /> Play
          </Link>
          {canContinue ? (
            <Link href="/mission?continue=1" className="btn btn-quiet text-lg">
              Continue mission
            </Link>
          ) : null}
          <Link href="/how-it-works" className="btn btn-quiet text-lg">
            How it works
          </Link>
        </div>
      </div>
      <div className="relative aspect-[16/11] overflow-hidden rounded-[16px] border border-line bg-deep">
        <MarsScene weather="High" className="absolute inset-0 h-full w-full" title="A habitat on the floor of Gale Crater, with Mount Sharp behind" />
        <div className="absolute left-3 top-3 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-haze/85 px-4 py-2.5 backdrop-blur sm:left-4 sm:top-4">
          <span className="label">Gale Crater, Mars</span>
          <span className="readout text-[13px] text-ink">{solCount.toLocaleString("en-US")} sols of real rover weather</span>
        </div>
      </div>
    </section>
  );
}
