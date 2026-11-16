"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RuleCard } from "@/contracts";
import { game } from "@/game";
import { Icon, type IconName } from "./icons";

const KIND_STYLE: Record<RuleCard["kind"], { cls: string; label: string }> = {
  "NASA measurement": { cls: "bg-battery-soft text-[#13689A]", label: "Real NASA data" },
  physics: { cls: "bg-sun-soft text-[#8A5408]", label: "Physics" },
  "game rule": { cls: "bg-air-soft text-[#0E7A5F]", label: "Game rule" },
};

export const KIND_LABEL = (kind: RuleCard["kind"]) => KIND_STYLE[kind].label;

export function KindBadge({ kind }: { kind: RuleCard["kind"] }) {
  const style = KIND_STYLE[kind];
  return <span className={`${style.cls} inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold`}>{style.label}</span>;
}

const RULE_ICON: Record<string, IconName> = {
  sunlight: "sun",
  solar: "bolt",
  nightLow: "thermo",
  keepAlive: "moon",
  huddle: "huddle",
  air: "air",
  crop: "sprout",
  "mars-day": "book",
};

export function RuleCardView({ card }: { card: RuleCard }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-haze text-dusk">
        <Icon name={RULE_ICON[card.id] ?? "book"} size={24} />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-xl font-bold text-ink">{card.title}</h3>
          <KindBadge kind={card.kind} />
        </div>
        <p className="text-ink-2">{card.plain}</p>
        <p className="tnum rounded-xl bg-haze px-3 py-2 text-[0.95rem] text-ink">{card.formula}</p>
        {card.source ? <p className="text-sm text-ink-2">Source: {card.source}</p> : null}
      </div>
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
        className="card m-auto w-[min(92vw,32rem)] p-0 backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
        aria-label={card ? card.title : "Rule card"}
      >
        {card ? (
          <div className="flex flex-col gap-4 p-6">
            <RuleCardView card={card} />
            <button className="btn btn-primary w-full" onClick={() => setOpenId(null)} autoFocus>
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
      className={`tnum inline cursor-help rounded underline decoration-current/40 decoration-dotted decoration-2 underline-offset-4 hover:decoration-current ${className}`}
      title="Where does this number come from?"
    >
      {children}
    </button>
  );
}
