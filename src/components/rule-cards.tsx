"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RuleCard } from "@/contracts";
import { game } from "@/game";

const KIND_STYLE: Record<RuleCard["kind"], { bg: string; icon: string }> = {
  "NASA measurement": { bg: "bg-blue", icon: "🛰️" },
  physics: { bg: "bg-sun", icon: "🔬" },
  "game rule": { bg: "bg-mint", icon: "🎲" },
};

export function KindBadge({ kind }: { kind: RuleCard["kind"] }) {
  const style = KIND_STYLE[kind];
  return (
    <span
      className={`${style.bg} inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold text-ink`}
    >
      <span aria-hidden>{style.icon}</span>
      {kind === "NASA measurement" ? "Real NASA data" : kind === "physics" ? "Physics" : "Game rule"}
    </span>
  );
}

export function RuleCardView({ card }: { card: RuleCard }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-2xl font-extrabold text-ink">{card.title}</h3>
        <KindBadge kind={card.kind} />
      </div>
      <p className="text-ink">{card.plain}</p>
      <p className="tnum rounded-2xl border-2 border-ink/20 bg-white/70 px-3 py-2 text-base text-ink">{card.formula}</p>
      {card.source ? (
        <p className="text-sm text-ink/80">
          <span className="font-bold">Source: </span>
          {card.source}
        </p>
      ) : null}
    </div>
  );
}

type Ctx = { open: (id: string) => void };
const RuleContext = createContext<Ctx>({ open: () => {} });

export function RuleCardsProvider({ children }: { children: ReactNode }) {
  const cards = useMemo(() => new Map(game.rules().map((card) => [card.id, card])), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const card = openId ? cards.get(openId) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (card && !dialog.open) dialog.showModal();
    if (!card && dialog.open) dialog.close();
  }, [card]);

  const open = useCallback((id: string) => setOpenId(id), []);

  return (
    <RuleContext.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={() => setOpenId(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenId(null);
        }}
        className="chunk m-auto w-[min(92vw,30rem)] bg-cream p-0 backdrop:bg-navy/70"
        aria-label={card ? card.title : "Rule card"}
      >
        {card ? (
          <div className="flex flex-col gap-4 p-6">
            <RuleCardView card={card} />
            <button className="btn btn-sun w-full" onClick={() => setOpenId(null)} autoFocus>
              Got it
            </button>
          </div>
        ) : null}
      </dialog>
    </RuleContext.Provider>
  );
}

/** A number on screen that opens its rule card when tapped. */
export function Num({ rule, children, className = "" }: { rule: string; children: ReactNode; className?: string }) {
  const { open } = useContext(RuleContext);
  return (
    <button
      type="button"
      onClick={() => open(rule)}
      className={`tnum inline cursor-help rounded-md underline decoration-dotted decoration-2 underline-offset-4 hover:bg-white/15 ${className}`}
      title="Where does this number come from?"
    >
      {children}
    </button>
  );
}
