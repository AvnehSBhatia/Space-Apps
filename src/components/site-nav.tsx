import Link from "next/link";
import type { ReactNode } from "react";

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5 leading-none text-ink">
      <svg viewBox="0 0 32 32" width={size === "lg" ? 34 : 26} height={size === "lg" ? 34 : 26} aria-hidden>
        <circle cx="16" cy="16" r="15" fill="var(--dusk)" />
        <path d="M1.5 19 C8 15 13 17 17 15.5 C22 13.5 26 15 30.5 13.5 L30.5 18 C30.5 25 24 31 16 31 C8 31 1.5 25 1.5 19 Z" fill="#b8381a" />
        <circle cx="22" cy="9" r="3" fill="var(--haze)" />
      </svg>
      <span className={`font-display tracking-[-0.04em] ${size === "lg" ? "text-4xl" : "text-[1.4rem]"}`}>SolCast</span>
    </span>
  );
}

/** Top bar used on every screen. `middle` shows the sol counter while a mission is running. */
export function SiteNav({ middle, right }: { middle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="border-b border-line bg-haze/85 backdrop-blur supports-[backdrop-filter]:bg-haze/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="SolCast home">
          <Wordmark />
        </Link>
        {middle ? (
          <div className="hidden items-center gap-4 text-ink sm:flex">
            <span className="h-6 w-px bg-line" aria-hidden />
            {middle}
          </div>
        ) : null}
        <nav className="ml-auto flex items-center gap-1 text-[0.98rem] font-medium sm:gap-2">{right}</nav>
      </div>
    </header>
  );
}

export function NavLink({ href, children, active = false }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-3 py-2 transition-colors hover:bg-card ${active ? "text-ink underline decoration-dusk decoration-2 underline-offset-[10px]" : "text-ink-2"}`}
    >
      {children}
    </Link>
  );
}
