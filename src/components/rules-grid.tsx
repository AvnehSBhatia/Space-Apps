"use client";

import { useState } from "react";
import type { RuleCard } from "@/contracts";
import { game } from "@/game";
import { KIND_LABEL, RuleCardView } from "./rule-cards";

type Filter = "all" | RuleCard["kind"];

export function RulesGrid() {
  const cards = game.rules();
  const [filter, setFilter] = useState<Filter>("all");
  const kinds: Filter[] = ["all", "NASA measurement", "physics", "game rule"];
  const shown = filter === "all" ? cards : cards.filter((card) => card.kind === filter);

  return (
    <>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
        {kinds.map((kind) => (
          <button
            key={kind}
            role="radio"
            aria-checked={filter === kind}
            onClick={() => setFilter(kind)}
            className={`min-h-11 rounded-full border px-4 text-[0.98rem] font-semibold transition-colors ${
              filter === kind ? "border-dusk bg-dusk text-white" : "border-line bg-white text-ink hover:border-[#b9c3da]"
            }`}
          >
            {kind === "all" ? "All" : KIND_LABEL(kind)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((card) => (
          <article key={card.id} id={card.id} className="card p-5 sm:p-6">
            <RuleCardView card={card} />
          </article>
        ))}
      </div>
    </>
  );
}
