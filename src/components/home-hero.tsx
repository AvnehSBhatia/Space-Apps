"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { SAVE_KEY } from "./format";
import styles from "./home-hero.module.css";
import { Icon } from "./icons";
import { MarsScene } from "./mars-scene";

// The 3D globe only loads in the browser. Until it is ready, the drawn crater scene shows.
const MarsGlobe3D = dynamic(() => import("./mars-globe-3d"), { ssr: false, loading: () => null });

const HEADLINE = "Keep a Mars outpost running on real rover weather.".split(" ");
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

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

let webglOk: boolean | null = null;
function hasWebGL(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglOk = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglOk = false;
  }
  return webglOk;
}

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const canShowGlobe = () => !window.matchMedia(REDUCED_MOTION).matches && hasWebGL();

/** If the 3D scene ever fails, quietly keep the drawn scene instead. */
class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Counts up from 0 once, the first time it shows. The real number is always there for screen readers. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = value.toLocaleString("en-US");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia(REDUCED_MOTION).matches) return;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / 1500, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(value * eased).toLocaleString("en-US");
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = value.toLocaleString("en-US");
    };
  }, [value]);

  return (
    <>
      <span className="sr-only">{final}</span>
      <span ref={ref} aria-hidden="true" className="inline-block text-right" style={{ minWidth: `${final.length}ch` }}>
        {final}
      </span>
    </>
  );
}

export function HomeHero({ solCount }: { solCount: number }) {
  const canContinue = useSyncExternalStore(subscribe, hasSave, () => false);
  const show3D = useSyncExternalStore(subscribeMotion, canShowGlobe, () => false);
  const [globeReady, setGlobeReady] = useState(false);
  const globeOn = show3D && globeReady;

  return (
    <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
      <div className="flex flex-col gap-6">
        <h1 className="text-[2.5rem] sm:text-[4rem]">
          {HEADLINE.map((word, i) => (
            <Fragment key={i}>
              <span className={styles.word}>
                <span className={styles.wordInner} style={{ "--i": i } as CSSProperties}>
                  {word}
                </span>
              </span>{" "}
            </Fragment>
          ))}
        </h1>
        <p className={`${styles.fadeUp} max-w-[34rem] text-xl text-ink-2`} style={{ "--delay": "520ms" } as CSSProperties}>
          Each sol, read the sky, plan your power, and see what really happened on Mars that night.
        </p>
        <div className={`${styles.fadeUp} flex flex-wrap gap-3`} style={{ "--delay": "640ms" } as CSSProperties}>
          <Link href="/mission" className={`btn btn-primary ${styles.play} min-w-40 text-lg`}>
            <Icon name="play" size={18} filled strokeWidth={0} className={styles.playIcon} /> Play
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
      <div className="relative aspect-[5/4] overflow-hidden rounded-[16px] border border-line bg-deep sm:aspect-[16/11] lg:aspect-[5/4]">
        {globeOn ? null : (
          <MarsScene weather="High" className="absolute inset-0 h-full w-full" title="A habitat on the floor of Gale Crater, with Mount Sharp behind" />
        )}
        {show3D ? (
          <GlobeBoundary>
            <div className={`absolute inset-0 ${styles.globeIn}`}>
              <MarsGlobe3D onReady={() => setGlobeReady(true)} />
            </div>
          </GlobeBoundary>
        ) : null}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-haze/85 px-4 py-2.5 backdrop-blur sm:left-4 sm:top-4">
          <span className="label flex items-center gap-2">
            {globeOn ? <span className={styles.dot} aria-hidden="true" /> : null}
            Gale Crater, Mars
          </span>
          <span className="readout text-[13px] text-ink">
            <CountUp value={solCount} /> sols of real rover weather
          </span>
        </div>
        {globeOn ? (
          <span className="label pointer-events-none absolute bottom-3 right-4" aria-hidden="true">
            Drag to spin
          </span>
        ) : null}
      </div>
    </section>
  );
}
