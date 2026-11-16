"use client";

/**
 * Mars, drawn in a shader. No model or texture files: the surface is layered noise, lit from one
 * side, with a warm rim of air. The blue marker sits on Gale Crater (4.6 S, 137.4 E), where the
 * Curiosity rover measured the weather. Decoration only, so the whole thing is aria-hidden.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import * as THREE from "three";

type Spin = { dragging: boolean; lastX: number; lastY: number; lastT: number; rotY: number; vel: number; tilt: number };

const BASE_SPEED = 0.07; // radians per second
const LIGHT = new THREE.Vector3(0.8, 0.32, 0.55).normalize();

function latLng(lat: number, lng: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

const GALE = latLng(-4.6, 137.4, 1);
const GALE_MARKER = GALE.clone().multiplyScalar(1.012);
const GALE_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), GALE);
// Start with Gale Crater facing the player, a little left of centre.
const START_ROT = -0.35 - Math.atan2(GALE.x, GALE.z);

// Fixed star field: the same sky on every visit.
const STARS = (() => {
  let seed = 4745;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const count = 420;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions.set([r * Math.cos(a) * 40, u * 40, r * Math.sin(a) * 40], i * 3);
    const b = 0.35 + rnd() * 0.65;
    colors.set([b, b * 0.96, b * 0.9], i * 3);
  }
  return { positions, colors };
})();

const VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
varying vec3 vView;
varying vec2 vUv;
void main() {
  vPos = position;
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const SURFACE_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vView;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec3(11.7, 3.1, 5.3);
    a *= 0.5;
  }
  return s;
}
void main() {
  vec3 p = normalize(vPos);
  float broad = fbm(p * 2.2);
  float detail = fbm(p * 6.5 + 4.0);
  float dark = smoothstep(0.5, 0.66, fbm(p * 1.5 + vec3(7.0)));
  vec3 rust = vec3(0.64, 0.27, 0.13);
  vec3 ochre = vec3(0.84, 0.53, 0.28);
  vec3 basalt = vec3(0.24, 0.13, 0.1);
  vec3 col = mix(rust, ochre, smoothstep(0.34, 0.68, broad));
  col = mix(col, basalt, dark * 0.78);
  col *= 0.8 + 0.4 * detail;
  float cap = smoothstep(0.86, 0.93, abs(p.y) + (detail - 0.5) * 0.1);
  col = mix(col, vec3(0.94, 0.91, 0.87), cap);
  vec3 n = normalize(vN);
  float day = smoothstep(-0.1, 0.5, dot(n, uLight));
  vec3 lit = col * (0.035 + 1.08 * day);
  float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
  lit += vec3(1.0, 0.56, 0.3) * rim * 0.4 * (0.15 + day);
  gl_FragColor = vec4(lit, 1.0);
}`;

const AIR_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float rim = clamp(-dot(n, normalize(vView)) / 0.5, 0.0, 1.0);
  float day = smoothstep(-0.6, 0.7, dot(n, uLight));
  gl_FragColor = vec4(vec3(1.0, 0.58, 0.32) * pow(rim, 2.2) * (0.16 + 0.84 * day), 1.0);
}`;

const MARKER_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.3, 0.22, d);
  float t = fract(uTime * 0.55);
  float ring = smoothstep(0.1, 0.0, abs(d - mix(0.28, 0.92, t))) * (1.0 - t);
  vec3 c = mix(vec3(0.486, 0.722, 0.925), vec3(1.0), core * 0.75);
  gl_FragColor = vec4(c, max(core, ring));
}`;

function Scene({ spinRef, labelRef }: { spinRef: RefObject<Spin>; labelRef: RefObject<HTMLDivElement | null> }) {
  const globe = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const markerMat = useRef<THREE.ShaderMaterial>(null);
  const lightUniforms = useMemo(() => ({ uLight: { value: LIGHT } }), []);
  const airUniforms = useMemo(() => ({ uLight: { value: LIGHT } }), []);
  const markerUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const scratch = useMemo(() => ({ pos: new THREE.Vector3(), toCam: new THREE.Vector3() }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const spin = spinRef.current;
    const g = globe.current;
    const t = tilt.current;
    if (!g || !t) return;
    if (!spin.dragging) {
      // Ease back to the slow spin after a flick.
      spin.vel += (BASE_SPEED - spin.vel) * (1 - Math.exp(-dt * 1.8));
      spin.rotY += spin.vel * dt;
      spin.tilt += -spin.tilt * (1 - Math.exp(-dt * 2.2));
    }
    g.rotation.y = spin.rotY;
    t.rotation.x = 0.14 + spin.tilt;
    if (markerMat.current) markerMat.current.uniforms.uTime.value = state.clock.elapsedTime;

    const label = labelRef.current;
    if (label) {
      const { pos, toCam } = scratch;
      g.localToWorld(pos.copy(GALE_MARKER));
      toCam.copy(state.camera.position).sub(pos).normalize();
      const facing = pos.clone().normalize().dot(toCam);
      pos.project(state.camera);
      const x = (pos.x * 0.5 + 0.5) * state.size.width;
      const y = (-pos.y * 0.5 + 0.5) * state.size.height;
      label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      label.style.opacity = facing > 0.18 ? "1" : "0";
    }
  });

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[STARS.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[STARS.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.7} sizeAttenuation={false} vertexColors transparent opacity={0.9} depthWrite={false} />
      </points>
      <group ref={tilt} rotation={[0.14, 0, 0.3]}>
        <group ref={globe} rotation={[0, START_ROT, 0]}>
          <mesh>
            <sphereGeometry args={[1, 64, 48]} />
            <shaderMaterial vertexShader={VERT} fragmentShader={SURFACE_FRAG} uniforms={lightUniforms} />
          </mesh>
          <mesh position={GALE_MARKER} quaternion={GALE_QUAT}>
            <circleGeometry args={[0.1, 24]} />
            <shaderMaterial ref={markerMat} vertexShader={VERT} fragmentShader={MARKER_FRAG} uniforms={markerUniforms} transparent depthWrite={false} />
          </mesh>
        </group>
      </group>
      <mesh>
        <sphereGeometry args={[1.14, 48, 32]} />
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={AIR_FRAG}
          uniforms={airUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export default function MarsGlobe3D({ onReady }: { onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<Spin>({ dragging: false, lastX: 0, lastY: 0, lastT: 0, rotY: START_ROT, vel: BASE_SPEED, tilt: 0 });
  const [active, setActive] = useState(true);

  // Stop drawing when the tab is hidden or the globe is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let onScreen = true;
    const update = () => setActive(onScreen && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.01 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    const spin = spinRef.current;
    spin.dragging = true;
    spin.lastX = event.clientX;
    spin.lastY = event.clientY;
    spin.lastT = event.timeStamp;
    spin.vel = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const spin = spinRef.current;
    if (!spin.dragging) return;
    const dx = (event.clientX - spin.lastX) * 0.006;
    const dt = Math.max((event.timeStamp - spin.lastT) / 1000, 0.008);
    spin.rotY += dx;
    spin.tilt = Math.max(-0.5, Math.min(0.5, spin.tilt + (event.clientY - spin.lastY) * 0.004));
    spin.vel = Math.max(-4, Math.min(4, spin.vel * 0.5 + (dx / dt) * 0.5));
    spin.lastX = event.clientX;
    spin.lastY = event.clientY;
    spin.lastT = event.timeStamp;
  };
  const onUp = () => {
    spinRef.current.dragging = false;
  };

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={active ? "always" : "never"}
        camera={{ position: [0, 0, 3.7], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={() => onReady?.()}
      >
        <color attach="background" args={["#0b0c0f"]} />
        <Scene spinRef={spinRef} labelRef={labelRef} />
      </Canvas>
      <div ref={labelRef} className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-300">
        <span className="readout ml-3 block -translate-y-1/2 whitespace-nowrap rounded-md border border-white/15 bg-haze/80 px-2 py-0.5 text-[12px] text-ink">
          Gale Crater
        </span>
      </div>
    </div>
  );
}
