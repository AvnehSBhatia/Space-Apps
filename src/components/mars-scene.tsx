/**
 * Gale Crater, drawn by hand. The view the Curiosity rover had: the crater floor, the rim far
 * behind, and Mount Sharp (Aeolis Mons) rising in the middle of the crater. The sky follows the
 * rover's measured sunlight; night and dust are layered on top. Pure SVG, no image files.
 */

import type { UvIndex } from "@/contracts";

export type SceneWeather = UvIndex | "night";

type Sky = { top: string; mid: string; low: string; sun: string; sunR: number; glow: number; haze: number; dust: number };

// Mars has a butterscotch sky by day; the colours are the artist's, the levels are the rover's.
const SKY: Record<SceneWeather, Sky> = {
  Very_High: { top: "#d98e5a", mid: "#ebb582", low: "#f5d6ad", sun: "#fff3dc", sunR: 30, glow: 1, haze: 0.18, dust: 0 },
  High: { top: "#c98256", mid: "#e0a67a", low: "#efc7a0", sun: "#ffefd6", sunR: 28, glow: 0.8, haze: 0.24, dust: 0 },
  Moderate: { top: "#a8735f", mid: "#c69580", low: "#ddb39b", sun: "#f7e6d6", sunR: 24, glow: 0.45, haze: 0.42, dust: 0.35 },
  Low: { top: "#5e3f2c", mid: "#87593d", low: "#a8774f", sun: "#e9d3b8", sunR: 18, glow: 0.12, haze: 0.7, dust: 1 },
  night: { top: "#0c0f17", mid: "#161b27", low: "#2a2b33", sun: "#000000", sunR: 0, glow: 0, haze: 0.1, dust: 0 },
};

// Fixed star field so the sky is the same on every render.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 397) % 1600;
  const y = (i * 151) % 300;
  const r = i % 7 === 0 ? 1.6 : i % 3 === 0 ? 1.1 : 0.7;
  return { x, y, r, d: (i % 9) * 0.35 };
});

export function MarsScene({
  weather,
  className = "",
  showHabitat = true,
  title,
}: {
  weather: SceneWeather;
  className?: string;
  showHabitat?: boolean;
  title?: string;
}) {
  const s = SKY[weather];
  const night = weather === "night";
  const uid = `ms-${weather}`;

  return (
    <svg
      viewBox="0 0 1600 640"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.top} />
          <stop offset="0.55" stopColor={s.mid} />
          <stop offset="1" stopColor={s.low} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={s.sun} stopOpacity={0.9 * s.glow} />
          <stop offset="0.25" stopColor={s.sun} stopOpacity={0.35 * s.glow} />
          <stop offset="1" stopColor={s.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b5683f" />
          <stop offset="1" stopColor="#8c4528" />
        </linearGradient>
        <linearGradient id={`${uid}-dome`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f1ede6" />
          <stop offset="0.62" stopColor="#e3ddd3" />
          <stop offset="0.63" stopColor="#c9c1b4" />
          <stop offset="1" stopColor="#b9b0a2" />
        </linearGradient>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
        </filter>
        <filter id={`${uid}-soft`}>
          <feGaussianBlur stdDeviation="28" />
        </filter>
      </defs>

      {/* sky */}
      <rect width="1600" height="640" fill={`url(#${uid}-sky)`} />
      {night
        ? STARS.map((star) => (
            <circle
              key={`${star.x}-${star.y}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#f4efe6"
              className={star.r > 1 ? "twinkle" : undefined}
              style={{ animationDelay: `${star.d}s` }}
              opacity={star.r > 1 ? 0.9 : 0.55}
            />
          ))
        : null}
      {night ? (
        <>
          {/* Phobos and Deimos, tiny and irregular */}
          <ellipse cx="1290" cy="96" rx="7" ry="5.5" fill="#cfc6b8" />
          <ellipse cx="1180" cy="150" rx="3.5" ry="3" fill="#bdb4a6" />
        </>
      ) : (
        <>
          <circle cx="1230" cy="150" r={s.sunR * 7} fill={`url(#${uid}-glow)`} />
          <circle cx="1230" cy="150" r={s.sunR} fill={s.sun} opacity={0.55 + 0.45 * s.glow} />
        </>
      )}

      {/* crater rim, far away and pale with distance */}
      <path
        d="M0 392 C120 372 210 380 320 366 C430 352 520 372 640 364 C760 356 880 372 1010 360 C1130 350 1250 366 1380 356 C1480 349 1550 358 1600 352 L1600 640 L0 640 Z"
        fill="#c98d68"
      />
      <rect y="340" width="1600" height="300" fill={s.low} opacity={0.55 * (1 - s.haze) + s.haze * 0.7} />

      {/* Mount Sharp: a broad layered mound with terraces */}
      <path
        d="M690 420 C760 404 800 380 850 366 C880 357 900 340 935 330 C962 322 980 300 1010 292 C1040 284 1062 296 1088 306 C1120 318 1140 336 1176 346 C1220 358 1262 372 1330 392 C1400 410 1470 418 1540 424 L1540 470 L690 470 Z"
        fill="#b9774f"
      />
      <path
        d="M850 366 C900 362 960 352 1020 350 C1080 348 1140 352 1176 346 M800 386 C880 380 980 374 1060 374 C1140 374 1230 380 1290 384"
        fill="none"
        stroke="#a7643f"
        strokeWidth="3"
        opacity="0.7"
      />
      <rect y="300" width="1600" height="340" fill={s.low} opacity={s.haze * 0.55} />

      {/* middle dunes */}
      <path
        d="M0 448 C140 430 260 440 380 436 C520 431 640 452 790 446 C930 440 1060 430 1200 436 C1340 442 1470 452 1600 444 L1600 640 L0 640 Z"
        fill="#ad6340"
      />
      <path d="M180 452 C260 444 330 446 400 450 M1120 444 C1200 438 1280 440 1360 446" stroke="#c27a52" strokeWidth="3" fill="none" />

      {/* foreground ground */}
      <path d="M0 492 C220 478 420 486 640 484 C900 482 1120 490 1340 486 C1460 484 1540 488 1600 486 L1600 640 L0 640 Z" fill={`url(#${uid}-ground)`} />

      {/* rocks */}
      <g fill="#7a3a22">
        <path d="M90 600 C96 576 126 566 150 572 C176 578 188 596 184 610 L86 612 Z" />
        <path d="M1410 590 C1418 572 1440 566 1458 572 C1476 580 1480 596 1474 604 L1404 606 Z" />
        <ellipse cx="420" cy="560" rx="16" ry="7" />
        <ellipse cx="980" cy="548" rx="11" ry="5" />
        <ellipse cx="1220" cy="600" rx="22" ry="9" />
        <ellipse cx="300" cy="520" rx="8" ry="3.5" />
        <ellipse cx="1520" cy="530" rx="9" ry="4" />
      </g>
      <g fill="#c98a62" opacity="0.6">
        <path d="M100 590 C110 578 130 574 146 578" stroke="#d29870" strokeWidth="3" fill="none" />
        <path d="M1418 584 C1426 576 1440 573 1452 576" stroke="#d29870" strokeWidth="3" fill="none" />
      </g>

      {showHabitat ? (
        <g>
          {/* shadow */}
          <ellipse cx="610" cy="520" rx="250" ry="14" fill="#5a2a17" opacity="0.35" />
          {/* supply module */}
          <rect x="430" y="470" width="96" height="44" rx="10" fill="#d9d2c6" />
          <rect x="430" y="470" width="96" height="16" rx="8" fill="#ebe5db" />
          <rect x="446" y="492" width="22" height="10" rx="3" fill={night ? "#ffcf7a" : "#4a4c52"} />
          {/* dome */}
          <path d="M520 516 C520 430 580 392 640 392 C700 392 760 430 760 516 Z" fill={`url(#${uid}-dome)`} />
          <path d="M556 444 C590 410 690 410 724 444" stroke="#c9c1b4" strokeWidth="2" fill="none" />
          <path d="M534 478 C580 452 700 452 746 478" stroke="#c9c1b4" strokeWidth="2" fill="none" />
          <rect x="608" y="470" width="40" height="46" rx="6" fill="#bdb4a6" />
          <rect x="614" y="476" width="28" height="40" rx="4" fill={night ? "#ffd694" : "#55575d"} />
          <circle cx="572" cy="470" r="9" fill={night ? "#ffcf7a" : "#4a4c52"} />
          <circle cx="702" cy="470" r="9" fill={night ? "#ffcf7a" : "#4a4c52"} />
          {/* mast */}
          <rect x="676" y="352" width="4" height="56" fill="#9a958d" />
          <circle cx="678" cy="350" r="5" fill={night ? "#ff4a1f" : "#d8d2c8"} className={night ? "twinkle" : undefined} />
          <path d="M690 386 l22 -12 l4 10 z" fill="#d8d2c8" />
          {/* tunnel to greenhouse */}
          <rect x="756" y="490" width="44" height="18" rx="8" fill="#cfc7ba" />
          {/* greenhouse: glass half-cylinder */}
          <path d="M796 516 C796 470 820 456 852 456 C884 456 908 470 908 516 Z" fill={night ? "#3d6b4f" : "#9fc7a8"} opacity="0.9" />
          <path d="M812 516 C812 482 828 470 852 470 C876 470 892 482 892 516" fill="none" stroke="#e8f1e6" strokeWidth="2" opacity="0.7" />
          <g fill={night ? "#8fd39e" : "#4f8a55"}>
            <ellipse cx="826" cy="508" rx="8" ry="6" />
            <ellipse cx="846" cy="504" rx="9" ry="7" />
            <ellipse cx="868" cy="507" rx="8" ry="6" />
            <ellipse cx="886" cy="510" rx="6" ry="5" />
          </g>
          {/* solar panels */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${950 + i * 92} 0)`}>
              <rect x="34" y="496" width="4" height="22" fill="#5f5a54" />
              <path d="M0 470 L74 470 L82 500 L-8 500 Z" fill={night ? "#1b2232" : "#2f3d55"} />
              <path d="M0 470 L74 470 L76 478 L-2 478 Z" fill={night ? "#2a3347" : "#5c7396"} opacity="0.9" />
              <path d="M25 470 L22 500 M50 470 L52 500" stroke={night ? "#26304a" : "#3f5272"} strokeWidth="1.5" />
            </g>
          ))}
          {night ? <circle cx="640" cy="470" r="120" fill="#ffcf7a" opacity="0.06" /> : null}
        </g>
      ) : null}

      {/* weather layers */}
      {s.dust > 0 ? (
        <g opacity={s.dust} filter={`url(#${uid}-soft)`}>
          <g className="dust">
            <ellipse cx="400" cy="300" rx="520" ry="120" fill="#9a6a45" opacity="0.55" />
            <ellipse cx="1200" cy="380" rx="560" ry="140" fill="#8a5a38" opacity="0.5" />
            <ellipse cx="800" cy="520" rx="700" ry="90" fill="#b07a50" opacity="0.45" />
          </g>
        </g>
      ) : null}
      {night ? <rect width="1600" height="640" fill="#0a0e1a" opacity="0.5" style={{ mixBlendMode: "multiply" }} /> : null}
      {night && showHabitat ? (
        <g>
          {/* windows stay lit above the night wash */}
          <circle cx="572" cy="470" r="9" fill="#ffcf7a" />
          <circle cx="702" cy="470" r="9" fill="#ffcf7a" />
          <rect x="614" y="476" width="28" height="40" rx="4" fill="#ffd694" />
          <rect x="446" y="492" width="22" height="10" rx="3" fill="#ffcf7a" />
          <circle cx="678" cy="350" r="5" fill="#ff4a1f" className="twinkle" />
        </g>
      ) : null}
      <rect width="1600" height="640" filter={`url(#${uid}-grain)`} opacity="0.1" />
    </svg>
  );
}

/** Solar conjunction: the Sun sits between Earth and Mars and blocks the radio link. */
export function ConjunctionArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1600 640" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <radialGradient id="cj-sun">
          <stop offset="0" stopColor="#fff3d6" />
          <stop offset="0.35" stopColor="#ffb347" />
          <stop offset="0.6" stopColor="#ff4a1f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff4a1f" stopOpacity="0" />
        </radialGradient>
        <filter id="cj-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
        </filter>
      </defs>
      <rect width="1600" height="640" fill="#141519" />
      {STARS.map((star) => (
        <circle key={`${star.x}-${star.y}`} cx={star.x} cy={(star.y * 2.1) % 640} r={star.r} fill="#eff0f1" opacity="0.5" />
      ))}
      <ellipse cx="800" cy="320" rx="640" ry="200" fill="none" stroke="#eff0f1" strokeOpacity="0.12" strokeWidth="2" />
      <ellipse cx="800" cy="320" rx="420" ry="132" fill="none" stroke="#eff0f1" strokeOpacity="0.12" strokeWidth="2" />
      <path d="M380 320 L1440 320" stroke="#eff0f1" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="4 14" strokeLinecap="round" />
      <circle cx="800" cy="320" r="260" fill="url(#cj-sun)" />
      <circle cx="800" cy="320" r="70" fill="#fff0cc" />
      {/* Earth */}
      <circle cx="380" cy="320" r="30" fill="#3f6fa8" />
      <path d="M362 306 C372 300 384 304 388 312 C380 318 368 318 362 306 Z M378 330 C388 326 398 332 396 340 C388 342 380 338 378 330 Z" fill="#6a9a5b" />
      {/* Mars */}
      <circle cx="1440" cy="320" r="22" fill="#c4562d" />
      <circle cx="1434" cy="314" r="5" fill="#a54522" />
      <rect width="1600" height="640" filter="url(#cj-grain)" opacity="0.1" />
    </svg>
  );
}
