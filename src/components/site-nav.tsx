import Link from "next/link";
import type { ReactNode } from "react";

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="relative inline-block font-display font-extrabold leading-none text-ink">
      <span className={size === "lg" ? "text-4xl" : "text-[1.6rem]"}>SolCast</span>
      <svg viewBox="0 0 120 10" className="absolute -bottom-2 left-1 w-[88%]" aria-hidden preserveAspectRatio="none">
        <path d="M2 7 Q60 -1 118 5" fill="none" stroke="var(--rust)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Top bar used on every screen. `middle` shows the sol counter while a mission is running. */
export function SiteNav({ middle, right }: { middle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="border-b border-line bg-haze/85 backdrop-blur supports-[backdrop-filter]:bg-haze/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="SolCast home" className="pb-1">
          <Wordmark />
        </Link>
        {middle ? (
          <div className="hidden items-center gap-4 text-ink sm:flex">
            <span className="h-6 w-px bg-line" aria-hidden />
            {middle}
          </div>
        ) : null}
        <nav className="ml-auto flex items-center gap-1 text-[0.98rem] font-semibold sm:gap-2">{right}</nav>
      </div>
    </header>
  );
}

export function NavLink({ href, children, active = false }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-3 py-2 transition-colors hover:bg-white ${active ? "text-ink underline decoration-rust decoration-2 underline-offset-[10px]" : "text-ink-2"}`}
    >
      {children}
    </Link>
  );
}
