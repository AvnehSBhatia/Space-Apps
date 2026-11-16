import type { SVGProps } from "react";

/** SolCast's own line icons. 24x24, round caps, drawn with currentColor. */

type IconName =
  | "sun"
  | "battery"
  | "air"
  | "food"
  | "sprout"
  | "heart"
  | "moon"
  | "thermo"
  | "dish"
  | "noSignal"
  | "brain"
  | "rocket"
  | "huddle"
  | "check"
  | "alert"
  | "star"
  | "play"
  | "copy"
  | "close"
  | "forward"
  | "cpu"
  | "bolt"
  | "book";

const PATHS: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="3" />
      <path d="M21.5 10.5v3M6 10.5v3M9.5 10.5v3" />
    </>
  ),
  air: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7" />,
  food: (
    <>
      <path d="M14.5 9.5 5 19c-.8.8.2 1.8 1 1l9.5-9.5" />
      <path d="M8.5 15.5 13 11M15.5 8.5c-2-2-1-5.5 0-6 .5 1.5 1.5 2 3 2-1 1 1 2.5 3 2.5-.5 1-4 3.5-6 1.5Z" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5ZM12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  thermo: (
    <>
      <path d="M10 14.2V5a2 2 0 1 1 4 0v9.2a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
    </>
  ),
  dish: (
    <>
      <path d="M5 13a7 7 0 0 0 7 7L5 13Z" />
      <path d="M5 13a7 7 0 0 0 7 7M8.5 16.5 13 12M13 12a1.2 1.2 0 1 0 0-.01M15 5a5 5 0 0 1 4 4M15 1.8a8 8 0 0 1 7.2 7.2M8 21h8" />
    </>
  ),
  noSignal: (
    <>
      <path d="M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.3M14.5 10.3a10 10 0 0 1 4.5 2.2M2 9a14 14 0 0 1 4-2.4M12 20h.01" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Z" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 3 3 0 0 1-3-3" />
      <path d="M12 10h2.5M12 14h3.5" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2.5c3.5 2.5 5 6 5 10l-2.5 3h-5L7 12.5c0-4 1.5-7.5 5-10Z" />
      <path d="M9.5 15.5 7 19l3-.5M14.5 15.5 17 19l-3-.5M12 9.5h.01M10.5 19.5 12 22l1.5-2.5" />
    </>
  ),
  huddle: (
    <>
      <path d="M3 18v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5M3 15h18M3 18v2M21 18v2" />
      <circle cx="8" cy="7" r="2" />
      <circle cx="16" cy="7" r="2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3Z" />,
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  forward: <path d="M3 6v12l8-6-8-6ZM13 6v12l8-6-8-6Z" />,
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
      <path d="M10 10h4v4h-4zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M8 7.5h8M8 11h6" />
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 2.2,
  filled = false,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };
