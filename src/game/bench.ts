// Balance bench for Part C. Plays every mission with fixed strategies and prints the table in
// docs/PART-C-GAME.md, plus the game self-checks. Not imported by the app.
//
// Compile it outside the repo (lint would scan the output otherwise), then run it:
//
//   npx tsc --outDir /tmp/solcast-bench --rootDir src --strict --target es2022 --module commonjs \
//     --moduleResolution node --resolveJsonModule --esModuleInterop --skipLibCheck src/game/bench.ts
//   node /tmp/solcast-bench/game/bench.js              # seed 2, the table in docs/PART-C-GAME.md
//   node /tmp/solcast-bench/game/bench.js --all-seeds  # seeds 0 to 8

import type { Bet, GameState, MissionId } from "../contracts";
import { carefulBet, game, playWith } from "./index";

const strategies: Record<string, (state: GameState) => Bet> = {
  careful: carefulBet,
  everything: (state) => ({ huddle: false, greenhouseWh: state.maxGreenhouseWh }),
  half: (state) => ({ huddle: false, greenhouseWh: state.maxGreenhouseWh / 2 }),
  nothing: () => ({ huddle: false, greenhouseWh: 0 }),
};

const missions: MissionId[] = ["calm2016", "conjunction2019", "dust2018"];
const seeds = process.argv.includes("--all-seeds") ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [2];

for (const seed of seeds) {
  console.log(`\nseed ${seed}`);
  for (const mission of missions) {
    const cells = Object.entries(strategies).map(([name, choose]) => {
      const end = playWith(mission, seed, choose);
      const result =
        end.ending === "survived"
          ? `survives ${end.score.total}`
          : `lost sol ${end.solIndex + 1} (hp ${end.outpost.crewHealth}, air ${end.outpost.airPercent}, meals ${end.outpost.meals})`;
      return `${name}: ${result}`;
    });
    console.log(`  ${mission.padEnd(16)} ${cells.join(" | ")}`);
  }
}

console.log("\nself-checks");
for (const result of game.selfCheck()) console.log(`  ${result.pass ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
