"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SAVE_KEY } from "./format";
import { Icon } from "./icons";

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

export function HomeHero() {
  const canContinue = useSyncExternalStore(subscribe, hasSave, () => false);

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
      <div className="flex flex-col gap-6">
        <h1 className="text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">Keep a Mars outpost running on real rover weather.</h1>
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
      <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] border border-line bg-ink shadow-[0_30px_60px_-30px_rgb(21_26_58/0.45)]">
        <Image
          src="/art/scene-day.webp"
          alt="A white dome habitat and solar panels on the rust-coloured plains of Mars"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 640px"
          className="object-cover object-[50%_70%]"
        />
        <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 font-semibold shadow-sm">
          <Icon name="sun" size={20} className="text-sun" /> Sunlight today: High
        </span>
        <span className="absolute bottom-2 right-3 rounded bg-black/40 px-1.5 text-[0.7rem] text-white">AI-generated art</span>
      </div>
    </section>
  );
}
