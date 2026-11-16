"use client";

/**
 * The outpost in Gale Crater as a small real-time diorama: a habitat dome, a greenhouse, four solar
 * panels and an antenna, with Mount Sharp behind. Everything is low-poly geometry made in code.
 * Nothing here decides a game rule: every colour, light and particle is derived from GameState and
 * eased toward its target, so locking in a plan plays as a sunset into night.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { GameState, UvIndex } from "@/contracts";

/* ------------------------------------------------------------------ */
/* The look: one set of targets per weather, eased every frame         */
/* ------------------------------------------------------------------ */

type Look = {
  skyTop: THREE.Color;
  horizon: THREE.Color;
  sunColor: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  windowColor: THREE.Color;
  plant: THREE.Color;
  fogNear: number;
  fogFar: number;
  sunLight: number;
  sunDisc: number;
  sunGlow: number;
  sunElev: number;
  hemi: number;
  rim: number;
  stars: number;
  dust: number;
  shadow: number;
  spill: number;
  greenhouse: number;
  ghSpill: number;
  beacon: number;
  win0: number;
  win1: number;
  win2: number;
};

// The horizon is eased on its own, more slowly, so the sky darkens from the top down like a sunset.
const COLOR_KEYS = ["skyTop", "sunColor", "hemiSky", "hemiGround", "windowColor", "plant"] as const;
const NUMBER_KEYS = [
  "fogNear",
  "fogFar",
  "sunLight",
  "sunDisc",
  "sunGlow",
  "sunElev",
  "hemi",
  "rim",
  "stars",
  "dust",
  "shadow",
  "spill",
  "greenhouse",
  "ghSpill",
  "beacon",
  "win0",
  "win1",
  "win2",
] as const;

type DayLook = {
  skyTop: string;
  horizon: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunLight: number;
  sunDisc: number;
  sunGlow: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  dust: number;
  shadow: number;
};

// Mars has a butterscotch sky by day. The colours are the artist's; the level is the rover's.
const DAY: Record<UvIndex, DayLook> = {
  Very_High: { skyTop: "#cf8650", horizon: "#f3cfa2", fogNear: 26, fogFar: 118, sunColor: "#fff1d6", sunLight: 3.1, sunDisc: 1, sunGlow: 1, hemiSky: "#ffe3bd", hemiGround: "#9a5230", hemi: 1.35, dust: 0, shadow: 0.42 },
  High: { skyTop: "#c27c50", horizon: "#ecc49b", fogNear: 20, fogFar: 96, sunColor: "#ffecd0", sunLight: 2.6, sunDisc: 1, sunGlow: 0.8, hemiSky: "#f6d6b0", hemiGround: "#95502f", hemi: 1.35, dust: 0, shadow: 0.33 },
  Moderate: { skyTop: "#a26f5e", horizon: "#d9ac96", fogNear: 9, fogFar: 62, sunColor: "#f7dfcc", sunLight: 1.7, sunDisc: 0.9, sunGlow: 0.5, hemiSky: "#e3bba6", hemiGround: "#8a4c32", hemi: 1.45, dust: 0.2, shadow: 0.18 },
  Low: { skyTop: "#5a3a22", horizon: "#9a6a44", fogNear: 2, fogFar: 30, sunColor: "#c9774a", sunLight: 0.55, sunDisc: 0.85, sunGlow: 0.22, hemiSky: "#b98a62", hemiGround: "#6e4026", hemi: 1.25, dust: 1, shadow: 0.04 },
};

const SUN_ELEV_DAY = 0.105;
const SUN_ELEV_NIGHT = -0.2;

type LookInput = {
  sunlight: UvIndex;
  night: boolean;
  blackout: boolean;
  huddle: boolean;
  /** 0 to 1: how much of today's greenhouse limit the lights are using. */
  glow: number;
  cold: boolean;
  cropDied: boolean;
};

function makeLook(p: LookInput): Look {
  const d = DAY[p.sunlight];
  const c = (hex: string) => new THREE.Color(hex);
  const lit = p.night ? (p.cold ? 0.55 : 2.4) : 0.2;
  const shared = {
    windowColor: c(p.night && p.cold ? "#7fa3d9" : "#ffcf7a"),
    plant: c(p.cropDied ? "#7a5a36" : "#4f9a55"),
    greenhouse: p.huddle ? 0 : p.glow,
    beacon: p.blackout ? 0 : 1,
    win0: lit,
    win1: p.huddle ? 0 : lit,
    win2: p.huddle ? 0 : lit,
  };
  if (p.night) {
    return {
      ...shared,
      skyTop: c("#05070f"),
      horizon: c("#171d2e"),
      sunColor: c("#ff7a3c"),
      hemiSky: c("#4a5c8f"),
      hemiGround: c("#15121c"),
      fogNear: 16,
      fogFar: 96,
      sunLight: 0,
      sunDisc: 1,
      sunGlow: 0,
      sunElev: SUN_ELEV_NIGHT,
      hemi: 0.55,
      rim: 1.7,
      stars: p.sunlight === "Low" ? 0.35 : 1,
      dust: p.sunlight === "Low" ? 0.4 : p.sunlight === "Moderate" ? 0.08 : 0,
      shadow: 0,
      spill: (p.cold ? 0.8 : 4.5) * (p.huddle ? 0.45 : 1),
      ghSpill: 5,
    };
  }
  return {
    ...shared,
    skyTop: c(d.skyTop),
    horizon: c(d.horizon),
    sunColor: c(d.sunColor),
    hemiSky: c(d.hemiSky),
    hemiGround: c(d.hemiGround),
    fogNear: d.fogNear,
    fogFar: d.fogFar,
    sunLight: d.sunLight,
    sunDisc: d.sunDisc,
    sunGlow: d.sunGlow,
    sunElev: SUN_ELEV_DAY,
    hemi: d.hemi,
    rim: 0,
    stars: 0,
    dust: d.dust,
    shadow: d.shadow,
    spill: 0,
    ghSpill: 1.5,
  };
}

function cloneLook(l: Look): Look {
  return {
    ...l,
    skyTop: l.skyTop.clone(),
    horizon: l.horizon.clone(),
    sunColor: l.sunColor.clone(),
    hemiSky: l.hemiSky.clone(),
    hemiGround: l.hemiGround.clone(),
    windowColor: l.windowColor.clone(),
    plant: l.plant.clone(),
  };
}

/* ------------------------------------------------------------------ */
/* Layout and fixed data (the same on every visit)                     */
/* ------------------------------------------------------------------ */

const DOME: [number, number, number] = [-1.5, 0, 0];
const DOME_R = 1.6;
const GREENHOUSE: [number, number, number] = [2.05, 0, 0];
const GREENHOUSE_R = 1.05;
const PANEL_X = [3.95, 4.75, 5.55, 6.35];
const PANEL_TILT = 0.5;

/** What the camera looks at, and how wide the diorama is around it. */
const FOCUS = { x: 1.6, y: 1.25, z: 0 };
const HALF_WIDTH = 5;
const FOV = 36;
const BASE_YAW = -0.42;

// The sun disc sits a little left of the view centre; Mount Sharp a little right.
const SUN_AZIMUTH = 0.26;
const SUN_X = Math.sin(SUN_AZIMUTH);
const SUN_Z = -Math.cos(SUN_AZIMUTH);
const MOUNT_AZIMUTH = 0.54;
const MOUNT: [number, number, number] = [FOCUS.x + Math.sin(MOUNT_AZIMUTH) * 64, 0, -Math.cos(MOUNT_AZIMUTH) * 64];

const DUST_COUNT = 650;
const DUST_HALF = 18;
const STAR_COUNT = 240;
const BURST_COUNT = 56;
const BURST_SECONDS = 2.8;

// [x, z, size]. All inside the flat pad around the outpost.
const ROCKS: [number, number, number][] = [
  [-4.6, 2.4, 0.42],
  [-3.9, 3.3, 0.2],
  [-0.4, 3.6, 0.26],
  [1.4, 5.2, 0.5],
  [2.2, 4.6, 0.22],
  [4.6, 3.1, 0.3],
  [6.4, 4.4, 0.6],
  [7.6, 1.6, 0.34],
  [8.2, -2.4, 0.5],
  [5.2, -3.6, 0.38],
  [0.6, -4.4, 0.55],
  [-2.8, -4.0, 0.3],
  [-5.2, -1.6, 0.36],
  [3.2, 6.6, 0.28],
  [-1.8, 6.2, 0.44],
  [0.2, 7.4, 0.2],
];

const PLANT_ROWS = [-0.42, 0, 0.42];
const PLANT_COLS = [-0.52, -0.26, 0, 0.26, 0.52];
const PLANT_COUNT = PLANT_ROWS.length * PLANT_COLS.length;

// [radiusBottom, radiusTop, height, x offset, colour]: the terraces of Mount Sharp.
const MOUNT_LAYERS: [number, number, number, number, string][] = [
  [26, 19, 2.6, 0, "#a8623f"],
  [19, 12.5, 2.6, 1.4, "#b56f48"],
  [12.5, 7, 2.4, 2.6, "#a25b3a"],
  [7, 2.4, 2.4, 3.3, "#bb7a51"],
];

// [azimuth, distance, radius, height]: low hills of the crater rim, almost lost in the haze.
const RIM_HILLS: [number, number, number, number][] = [
  [-0.35, 92, 22, 6],
  [0.05, 100, 26, 5],
  [1.05, 90, 24, 7],
  [1.45, 84, 18, 5],
];

/** Small seeded generator, so the dust and the stars are the same on every render. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Rolling ground with a flat pad under the outpost, coloured per vertex. */
function buildTerrain() {
  const geo = new THREE.PlaneGeometry(260, 260, 84, 84);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color("#7f3d24");
  const mid = new THREE.Color("#b0603a");
  const pale = new THREE.Color("#cb8759");
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x - FOCUS.x, z);
    const pad = smooth(7, 17, d);
    const far = smooth(30, 110, d);
    const n = Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 - 0.4) * 0.55 + Math.sin(x * 0.47 + z * 0.33) * 0.2 + Math.sin(z * 0.83 - x * 0.29 + 2.1) * 0.08;
    const y = n * pad * (0.75 + far * 2.2) + far * far * 1.4;
    pos.setY(i, y);
    tmp.copy(dark).lerp(mid, Math.min(1, Math.max(0, 0.6 + n * 0.7)));
    tmp.lerp(pale, Math.min(0.7, Math.max(0, y * 0.22 + Math.sin(x * 1.7 + z * 2.3) * 0.08)));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildDust() {
  const r = seeded(11);
  const positions = new Float32Array(DUST_COUNT * 3);
  const speeds = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = (r() * 2 - 1) * DUST_HALF;
    positions[i * 3 + 1] = 0.1 + r() * r() * 7;
    positions[i * 3 + 2] = -10 + r() * 19;
    speeds[i] = 4 + r() * 5.5;
  }
  return { positions, speeds };
}

function buildStars() {
  const r = seeded(29);
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.04 + r() * 0.9;
    const h = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(a) * h * 170;
    positions[i * 3 + 1] = y * 170;
    positions[i * 3 + 2] = Math.sin(a) * h * 170;
  }
  return positions;
}

function buildBurst() {
  const r = seeded(47);
  const positions = new Float32Array(BURST_COUNT * 3);
  // angle, radius, rise speed, wobble phase
  const seeds = new Float32Array(BURST_COUNT * 4);
  for (let i = 0; i < BURST_COUNT; i++) {
    seeds[i * 4] = r() * Math.PI * 2;
    seeds[i * 4 + 1] = Math.sqrt(r()) * 0.85;
    seeds[i * 4 + 2] = 0.7 + r() * 0.9;
    seeds[i * 4 + 3] = r() * 6.28;
  }
  return { positions, seeds };
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A vertical gradient with the sun drawn into it: a soft glow and a small disc.
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uDisc;
uniform float uGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float t = pow(smoothstep(-0.02, 0.7, d.y), 0.62);
  vec3 col = mix(uHorizon, uTop, t);
  vec3 s = normalize(uSunDir);
  float sd = max(dot(d, s), 0.0);
  float up = smoothstep(-0.06, 0.03, s.y);
  col += uSunColor * (pow(sd, 26.0) * 0.5 + pow(sd, 240.0) * 0.55) * uGlow * up;
  col = mix(col, uSunColor, smoothstep(0.99935, 0.9996, sd) * uDisc * up);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

type PointerRef = { current: { x: number; y: number } };

function Scene({
  target,
  burstKey,
  pointer,
  onReady,
  onLost,
}: {
  target: Look;
  burstKey: number;
  pointer: PointerRef;
  onReady?: () => void;
  onLost?: () => void;
}) {
  const gl = useThree((s) => s.gl);

  const live = useRef<Look | null>(null);
  const started = useRef(false);
  const eased = useRef({ x: 0, y: 0 });
  const burstPending = useRef(false);
  const burstAt = useRef(-1);

  const sky = useRef<THREE.ShaderMaterial>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const stars = useRef<THREE.Points>(null);
  const dust = useRef<THREE.Points>(null);
  const burst = useRef<THREE.Points>(null);
  const shadows = useRef<THREE.Group>(null);
  const panels = useRef<THREE.Group>(null);
  const mast = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const windowA = useRef<THREE.MeshStandardMaterial>(null);
  const windowB = useRef<THREE.MeshStandardMaterial>(null);
  const windowDoor = useRef<THREE.MeshStandardMaterial>(null);
  const windowLight = useRef<THREE.PointLight>(null);
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const plantMat = useRef<THREE.MeshStandardMaterial>(null);
  const greenLight = useRef<THREE.PointLight>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const plants = useRef<THREE.InstancedMesh>(null);

  const terrain = useMemo(() => buildTerrain(), []);
  const dustData = useMemo(() => buildDust(), []);
  const starPositions = useMemo(() => buildStars(), []);
  const burstData = useMemo(() => buildBurst(), []);
  const skyUniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color("#cf8650") },
      uHorizon: { value: new THREE.Color("#f3cfa2") },
      uSunDir: { value: new THREE.Vector3(SUN_X, SUN_ELEV_DAY, SUN_Z) },
      uSunColor: { value: new THREE.Color("#fff1d6") },
      uDisc: { value: 1 },
      uGlow: { value: 1 },
    }),
    [],
  );

  useEffect(() => () => terrain.dispose(), [terrain]);

  // A lost graphics context cannot draw: tell the page so it can show the flat scene instead.
  useEffect(() => {
    const el = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onLost?.();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);

  useEffect(() => {
    if (burstKey > 0) burstPending.current = true;
  }, [burstKey]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const rockMesh = rocks.current;
    if (rockMesh) {
      ROCKS.forEach(([x, z, size], i) => {
        e.set(i * 0.7, i * 1.9, i * 0.3);
        q.setFromEuler(e);
        p.set(x, size * 0.22, z);
        s.set(size, size * 0.62, size * 0.86);
        rockMesh.setMatrixAt(i, m.compose(p, q, s));
      });
      rockMesh.instanceMatrix.needsUpdate = true;
    }
    const plantMesh = plants.current;
    if (plantMesh) {
      let i = 0;
      for (const z of PLANT_ROWS) {
        for (const x of PLANT_COLS) {
          const size = 0.85 + ((i * 37) % 10) / 28;
          e.set(0, i * 1.3, 0);
          q.setFromEuler(e);
          p.set(x, 0.34, z);
          s.set(size, size * 1.15, size);
          plantMesh.setMatrixAt(i, m.compose(p, q, s));
          i++;
        }
      }
      plantMesh.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;

    let c = live.current;
    if (!c) {
      c = cloneLook(target);
      live.current = c;
    }

    // Ease every value toward its target: about 1.2 seconds to settle.
    const k = 1 - Math.exp(-dt * 3.3);
    const kSlow = 1 - Math.exp(-dt * 2);
    for (const key of COLOR_KEYS) c[key].lerp(target[key], k);
    c.horizon.lerp(target.horizon, kSlow);
    for (const key of NUMBER_KEYS) c[key] += (target[key] - c[key]) * k;

    const skyMat = sky.current;
    if (skyMat) {
      const u = skyMat.uniforms;
      (u.uTop.value as THREE.Color).copy(c.skyTop);
      (u.uHorizon.value as THREE.Color).copy(c.horizon);
      (u.uSunColor.value as THREE.Color).copy(c.sunColor);
      (u.uSunDir.value as THREE.Vector3).set(SUN_X, c.sunElev, SUN_Z);
      u.uDisc.value = c.sunDisc;
      u.uGlow.value = c.sunGlow;
    }

    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(c.horizon);
      fog.near = c.fogNear;
      fog.far = c.fogFar;
    }

    if (hemi.current) {
      hemi.current.color.copy(c.hemiSky);
      hemi.current.groundColor.copy(c.hemiGround);
      hemi.current.intensity = c.hemi;
    }
    if (sun.current) {
      sun.current.color.copy(c.sunColor);
      sun.current.intensity = c.sunLight;
    }
    if (rim.current) rim.current.intensity = c.rim;

    if (stars.current) {
      stars.current.visible = c.stars > 0.01;
      (stars.current.material as THREE.PointsMaterial).opacity = c.stars * (0.86 + 0.14 * Math.sin(t * 1.3));
    }

    // Dust streams sideways and wraps round; skipped entirely on a clear day.
    const dustPoints = dust.current;
    if (dustPoints) {
      dustPoints.visible = c.dust > 0.01;
      if (dustPoints.visible) {
        (dustPoints.material as THREE.PointsMaterial).opacity = Math.min(0.85, c.dust * 0.85);
        const attr = dustPoints.geometry.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const gust = (0.45 + c.dust) * (1 + 0.25 * Math.sin(t * 0.7));
        for (let i = 0; i < DUST_COUNT; i++) {
          let x = arr[i * 3] + dustData.speeds[i] * dt * gust;
          if (x > DUST_HALF) x -= DUST_HALF * 2;
          arr[i * 3] = x;
          arr[i * 3 + 1] += Math.sin(t * 1.3 + i) * dt * 0.25;
        }
        attr.needsUpdate = true;
      }
    }

    // Harvest: one short burst of green sparks rising out of the greenhouse.
    if (burstPending.current) {
      burstPending.current = false;
      burstAt.current = t;
    }
    const burstPoints = burst.current;
    if (burstPoints) {
      const age = burstAt.current < 0 ? -1 : t - burstAt.current;
      if (age >= 0 && age < BURST_SECONDS) {
        burstPoints.visible = true;
        const attr = burstPoints.geometry.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const sd = burstData.seeds;
        for (let i = 0; i < BURST_COUNT; i++) {
          const spread = sd[i * 4 + 1] * (1 + age * 0.35);
          const wobble = Math.sin(age * 3 + sd[i * 4 + 3]) * 0.08;
          arr[i * 3] = GREENHOUSE[0] + Math.cos(sd[i * 4]) * spread + wobble;
          arr[i * 3 + 1] = 0.35 + sd[i * 4 + 2] * age * 1.25;
          arr[i * 3 + 2] = GREENHOUSE[2] + Math.sin(sd[i * 4]) * spread;
        }
        attr.needsUpdate = true;
        const fade = 1 - (age / BURST_SECONDS) ** 2;
        (burstPoints.material as THREE.PointsMaterial).opacity = Math.min(1, age * 5) * fade;
      } else if (burstPoints.visible) {
        burstPoints.visible = false;
        burstAt.current = -1;
      }
    }

    const glows = [c.win0, c.win1, c.win2];
    [windowA.current, windowB.current, windowDoor.current].forEach((mat, i) => {
      if (!mat) return;
      mat.emissive.copy(c.windowColor);
      mat.emissiveIntensity = glows[i];
    });
    if (windowLight.current) {
      windowLight.current.color.copy(c.windowColor);
      windowLight.current.intensity = c.spill;
    }

    if (glass.current) {
      glass.current.emissiveIntensity = c.greenhouse * 1.7;
      glass.current.opacity = 0.28 + 0.3 * c.greenhouse;
    }
    if (plantMat.current) {
      plantMat.current.color.copy(c.plant);
      plantMat.current.emissiveIntensity = c.greenhouse * 0.9;
    }
    if (greenLight.current) greenLight.current.intensity = c.greenhouse * c.ghSpill;

    // The antenna light: a slow blink while Earth is in contact, dark in a blackout.
    if (beacon.current) {
      const pulse = Math.max(0, Math.sin(t * 1.7)) ** 6;
      beacon.current.emissiveIntensity = c.beacon * (0.12 + 3 * pulse);
    }

    if (shadows.current) {
      for (const child of shadows.current.children) {
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = c.shadow;
      }
    }

    // Tiny idle motion: the panels track, the mast sways.
    if (panels.current) {
      panels.current.children.forEach((panel, i) => {
        const head = panel.children[1];
        if (head) head.rotation.z = PANEL_TILT + 0.022 * Math.sin(t * 0.4 + i * 0.9);
      });
    }
    if (mast.current) mast.current.rotation.z = 0.012 * Math.sin(t * 0.9);

    // Camera: a slow drift, a gentle dolly, and a little parallax that follows the pointer.
    const e = eased.current;
    const follow = 1 - Math.exp(-dt * 2.2);
    e.x += (pointer.current.x - e.x) * follow;
    e.y += (pointer.current.y - e.y) * follow;
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / Math.max(1, state.size.height);
    const fit = HALF_WIDTH / (Math.tan((FOV * Math.PI) / 360) * aspect);
    const dist = Math.min(14.5, Math.max(8.4, fit)) * (1 + 0.025 * Math.sin(t * 0.11));
    const yaw = BASE_YAW + 0.065 * Math.sin(t * 0.16) + e.x * 0.05;
    cam.position.set(FOCUS.x + Math.sin(yaw) * dist, FOCUS.y + dist * 0.086 - e.y * 0.28, FOCUS.z + Math.cos(yaw) * dist);
    cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);

    if (!started.current) {
      started.current = true;
      onReady?.();
    }
  });

  return (
    <>
      <fog attach="fog" args={["#f3cfa2", 26, 118]} />
      <hemisphereLight ref={hemi} args={["#ffe3bd", "#9a5230", 1.35]} />
      <directionalLight ref={sun} position={[-9, 9, -3.5]} intensity={3.1} color="#fff1d6" />
      <directionalLight ref={rim} position={[7, 4, -8]} intensity={0} color="#8fb0ff" />

      {/* sky dome, with the sun drawn in */}
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[180, 24, 16]} />
        <shaderMaterial
          ref={sky}
          uniforms={skyUniforms}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <points ref={stars} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#f4efe6" size={1.9} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>

      {/* ground, Mount Sharp and the far crater rim */}
      <mesh geometry={terrain}>
        <meshLambertMaterial vertexColors flatShading />
      </mesh>
      <group position={MOUNT} scale={[1, 1, 0.72]}>
        {MOUNT_LAYERS.map(([bottom, top, height, shift, colour], i) => (
          <mesh
            key={colour}
            position={[shift, MOUNT_LAYERS.slice(0, i).reduce((sum, layer) => sum + layer[2], 0) + height / 2, 0]}
            rotation-y={i * 0.55}
          >
            <cylinderGeometry args={[top, bottom, height, 9, 1]} />
            <meshLambertMaterial color={colour} flatShading />
          </mesh>
        ))}
      </group>
      {RIM_HILLS.map(([azimuth, distance, radius, height]) => (
        <mesh key={azimuth} position={[FOCUS.x + Math.sin(azimuth) * distance, height / 2 - 0.4, -Math.cos(azimuth) * distance]}>
          <coneGeometry args={[radius, height, 7]} />
          <meshLambertMaterial color="#b9774f" flatShading />
        </mesh>
      ))}
      <instancedMesh ref={rocks} args={[undefined, undefined, ROCKS.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color="#7a3a22" flatShading />
      </instancedMesh>

      {/* soft ground shadows that fade with the sun */}
      <group ref={shadows}>
        <mesh position={[DOME[0] + 0.74, 0.02, 0.3]} rotation={[-Math.PI / 2, 0, -0.38]} scale={[2.4, 1.62, 1]}>
          <circleGeometry args={[1, 28]} />
          <meshBasicMaterial color="#3b1b10" transparent opacity={0.4} depthWrite={false} />
        </mesh>
        <mesh position={[GREENHOUSE[0] + 0.49, 0.021, 0.19]} rotation={[-Math.PI / 2, 0, -0.38]} scale={[1.58, 1.07, 1]}>
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#3b1b10" transparent opacity={0.4} depthWrite={false} />
        </mesh>
        <mesh position={[5.5, 0.022, -0.22]} rotation={[-Math.PI / 2, 0, 0]} scale={[2, 0.78, 1]}>
          <circleGeometry args={[1, 24]} />
          <meshBasicMaterial color="#3b1b10" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>

      {/* habitat dome */}
      <group position={DOME}>
        <mesh>
          <sphereGeometry args={[DOME_R, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f2eee7" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[DOME_R + 0.06, DOME_R + 0.1, 0.2, 30]} />
          <meshStandardMaterial color="#c9c1b4" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.414, 0.018, 6, 40]} />
          <meshStandardMaterial color="#cfc7ba" roughness={0.8} />
        </mesh>

        {/* airlock and door */}
        <group rotation-y={-0.2}>
          <mesh position={[0, 0.5, 1.42]}>
            <boxGeometry args={[0.74, 1, 0.6]} />
            <meshStandardMaterial color="#d9d2c6" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.43, 1.725]}>
            <boxGeometry args={[0.5, 0.8, 0.03]} />
            <meshStandardMaterial color="#a9a298" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.6, 1.745]}>
            <circleGeometry args={[0.13, 16]} />
            <meshStandardMaterial ref={windowDoor} color="#2c2f36" roughness={0.3} emissive="#ffcf7a" emissiveIntensity={0.2} />
          </mesh>
        </group>

        {/* round windows */}
        {[0.5, -0.9].map((angle, i) => (
          <group
            key={angle}
            position={[Math.sin(angle) * 1.386, 0.8, Math.cos(angle) * 1.386]}
            rotation={[-0.5236, angle, 0, "YXZ"]}
          >
            <mesh position={[0, 0, -0.03]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.3, 0.33, 0.16, 18]} />
              <meshStandardMaterial color="#bdb4a6" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.056]}>
              <circleGeometry args={[0.23, 18]} />
              <meshStandardMaterial ref={i === 0 ? windowA : windowB} color="#2c2f36" roughness={0.3} emissive="#ffcf7a" emissiveIntensity={0.2} />
            </mesh>
          </group>
        ))}

        {/* antenna mast with its light */}
        <group ref={mast} position={[-0.5, 1.46, -0.35]}>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.022, 0.03, 1.44, 6]} />
            <meshStandardMaterial color="#9a958d" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.13, 0.86, 0]} rotation={[0, 0, -1.1]}>
            <coneGeometry args={[0.17, 0.12, 12, 1, true]} />
            <meshStandardMaterial color="#d8d2c8" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial ref={beacon} color="#3a2a26" roughness={0.4} emissive="#ff4a1f" emissiveIntensity={0.12} />
          </mesh>
        </group>
      </group>
      <pointLight ref={windowLight} position={[-1.9, 0.75, 2.4]} intensity={0} distance={7} decay={2} color="#ffcf7a" />

      {/* connecting tube */}
      <mesh position={[0.57, 0.45, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.42, 0.42, 1.2, 14]} />
        <meshStandardMaterial color="#d6cfc3" roughness={0.75} />
      </mesh>

      {/* greenhouse */}
      <group position={GREENHOUSE}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[GREENHOUSE_R + 0.04, GREENHOUSE_R + 0.07, 0.16, 26]} />
          <meshStandardMaterial color="#c9c1b4" roughness={0.8} />
        </mesh>
        {PLANT_ROWS.map((z) => (
          <mesh key={z} position={[0, 0.2, z]}>
            <boxGeometry args={[1.34, 0.12, 0.26]} />
            <meshStandardMaterial color="#6d5a48" roughness={0.9} />
          </mesh>
        ))}
        <instancedMesh ref={plants} args={[undefined, undefined, PLANT_COUNT]}>
          <icosahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial ref={plantMat} color="#4f9a55" roughness={0.8} flatShading emissive="#6fd3a6" emissiveIntensity={0} />
        </instancedMesh>
        {[0, Math.PI / 2].map((turn) => (
          <mesh key={turn} rotation-y={turn}>
            <torusGeometry args={[GREENHOUSE_R, 0.02, 6, 22, Math.PI]} />
            <meshStandardMaterial color="#eef4ec" roughness={0.6} />
          </mesh>
        ))}
        <mesh renderOrder={2}>
          <sphereGeometry args={[GREENHOUSE_R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            ref={glass}
            color="#bfe6d0"
            roughness={0.15}
            transparent
            opacity={0.28}
            depthWrite={false}
            emissive="#6fd3a6"
            emissiveIntensity={0}
          />
        </mesh>
        <pointLight ref={greenLight} position={[0, 0.7, 0]} intensity={0} distance={6} decay={2} color="#8ff0b0" />
      </group>

      {/* four solar panels on short legs, leaning toward the sun */}
      <group ref={panels}>
        {PANEL_X.map((x) => (
          <group key={x} position={[x, 0, -0.5]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.035, 0.045, 0.6, 6]} />
              <meshStandardMaterial color="#5f5a54" roughness={0.6} metalness={0.3} />
            </mesh>
            <group position={[0, 0.62, 0]} rotation={[-0.16, 0, PANEL_TILT]}>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.78, 0.03, 1.22]} />
                <meshStandardMaterial color="#c9c1b4" roughness={0.7} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.7, 0.035, 1.14]} />
                <meshStandardMaterial color="#2b4674" roughness={0.3} metalness={0.35} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* dust for hazy and stormy sols */}
      <points ref={dust} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e0b089" size={0.11} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>

      {/* harvest sparks */}
      <points ref={burst} visible={false} frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[burstData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#b9f08a"
          size={0.13}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The canvas                                                          */
/* ------------------------------------------------------------------ */

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const pageIsVisible = () => document.visibilityState !== "hidden";
const pageIsVisibleOnServer = () => true;

export function Outpost3D({
  state,
  className = "",
  onReady,
  onLost,
}: {
  state: GameState;
  className?: string;
  /** Called once, after the first frame has been drawn. */
  onReady?: () => void;
  /** Called if the browser takes the graphics context away. */
  onLost?: () => void;
}) {
  const night = state.phase === "night" || state.phase === "ended";
  const last = state.outcomes[state.outcomes.length - 1];
  const bet = night && last ? last.bet : state.bet;
  const huddle = state.bet.huddle || bet.huddle;
  const glow = state.maxGreenhouseWh > 0 ? Math.min(1, Math.max(0, bet.greenhouseWh / state.maxGreenhouseWh)) : 0;
  const cold = !!last && last.hoursCold > 0;
  const cropDied = !!last && last.cropDied;
  const blackout = state.contact === "blackout";
  const sunlight = state.sunlight;
  // A new number for every harvest night, so each one sets off its own burst.
  const burstKey = night && last && last.mealsHarvested > 0 ? state.outcomes.length : 0;

  const target = useMemo(
    () => makeLook({ sunlight, night, blackout, huddle, glow, cold, cropDied }),
    [sunlight, night, blackout, huddle, glow, cold, cropDied],
  );

  // Stop drawing when nobody can see the scene: a hidden tab, or scrolled off the screen.
  const wrap = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const pageVisible = useSyncExternalStore(subscribeVisibility, pageIsVisible, pageIsVisibleOnServer);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer.current.y = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <div ref={wrap} className={className} style={{ pointerEvents: "none" }} aria-hidden="true">
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.5]}
        frameloop={pageVisible && inView ? "always" : "never"}
        camera={{ fov: FOV, near: 0.5, far: 420, position: [-3.3, 2.3, 11] }}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: "high-performance" }}
        resize={{ scroll: false }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.05;
          gl.setClearColor("#18191b");
          gl.domElement.setAttribute("aria-hidden", "true");
        }}
      >
        <Scene target={target} burstKey={burstKey} pointer={pointer} onReady={onReady} onLost={onLost} />
      </Canvas>
    </div>
  );
}
