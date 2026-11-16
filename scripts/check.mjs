#!/usr/bin/env node
// Runs the brain and game self-checks against the real NASA record, outside the browser.
//
//   npm run check                         every check, plus how each tool does on each real stretch
//   npm run check -- --tool longMemory    one tool alone (the other tool files are not compiled)
//
// Exits 1 if any check fails or the code does not compile.

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const toolIndex = process.argv.indexOf("--tool");
const toolName = toolIndex === -1 ? null : process.argv[toolIndex + 1];

const tsc = process.env.TSC || path.join(root, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(tsc)) {
  console.error("TypeScript is not installed. Run `npm install` first.");
  process.exit(1);
}

// Each run compiles into its own folder, so several people or agents can run checks at once.
const out = path.join(root, ".check", String(process.pid));
const entries = toolName
  ? ["src/brain/bench.ts", `src/brain/tools/${toolName}.ts`]
  : ["src/game/index.ts", "src/brain/bench.ts", "src/brain/scoreboard.ts"];

const compiled = spawnSync(
  process.execPath,
  [
    tsc,
    "--outDir", out,
    "--rootDir", "src",
    "--strict",
    "--target", "es2022",
    "--module", "commonjs",
    "--moduleResolution", "node10",
    "--resolveJsonModule",
    "--esModuleInterop",
    "--skipLibCheck",
    "--noEmitOnError",
    ...entries,
  ],
  { cwd: root, stdio: "inherit" },
);

let failed = compiled.status !== 0;
const show = (title, results) => {
  console.log(`\n${title}`);
  for (const result of results) {
    if (!result.pass) failed = true;
    console.log(`  ${result.pass ? "PASS" : "FAIL"} ${result.name}${result.pass ? "" : `  ->  ${result.detail}`}`);
  }
};
const table = (title, rows) => {
  console.log(`\n${title}`);
  console.log("  stretch            target      tool miss  copycat   fit ms   guess ms");
  for (const row of rows) {
    console.log(
      `  ${row.window.padEnd(18)} ${row.target.padEnd(10)} ${row.toolMiss.toFixed(3).padStart(9)} ${row.copycatMiss
        .toFixed(3)
        .padStart(8)} ${row.fitMs.toFixed(3).padStart(8)} ${row.guessMs.toFixed(4).padStart(10)}`,
    );
  }
};

try {
  if (!failed) {
    const bench = require(path.join(out, "brain", "bench.js"));
    if (toolName) {
      const tool = require(path.join(out, "brain", "tools", `${toolName}.js`))[toolName];
      if (!tool) throw new Error(`src/brain/tools/${toolName}.ts must export a ToolModule named ${toolName}`);
      show(`${tool.info.name}: standard checks`, bench.standardChecks(tool));
      if (tool.checks) show(`${tool.info.name}: its own checks`, tool.checks());
      table(`${tool.info.name} alone, on the real record`, bench.benchTool(tool));
      console.log(`\nready: ${tool.info.ready}`);
    } else {
      const { brain, rangeCoverage } = require(path.join(out, "brain", "index.js"));
      const { game } = require(path.join(out, "game", "index.js"));
      const { TOOLS } = require(path.join(out, "brain", "tools", "index.js"));
      const { allReadings } = require(path.join(out, "lib", "nasa", "readings.js"));
      show("Part A: brain", brain.selfCheck());
      show("Part C: game", game.selfCheck());
      for (const tool of TOOLS.filter((candidate) => candidate.info.ready)) {
        table(`${tool.info.name} alone, on the real record`, bench.benchTool(tool));
      }
      const ready = TOOLS.filter((tool) => tool.info.ready).map((tool) => ({ uid: tool.info.id, id: tool.info.id, knobs: {} }));
      const core = ready.filter((tool) => ["copycat", "averager", "season", "trend"].includes(tool.id));
      console.log("\nThe blended brain, test flights on the real record");
      console.log("  stretch            target      design      miss   +/-    copycat  worst");
      for (const window of bench.WINDOWS) {
        const history = allReadings().filter((reading) => reading.sol <= window.toSol);
        for (const target of ["nightLowC", "sunlight"]) {
          for (const [label, tools] of [["core 4", core], ["all ready", ready]]) {
            const flight = brain.testFlight({ tools }, history, target, window.toSol - window.fromSol + 1, 1);
            console.log(
              `  ${window.name.padEnd(18)} ${target.padEnd(10)}  ${label.padEnd(10)} ${flight.averageMiss
                .toFixed(3)
                .padStart(6)} ${flight.missNoise.toFixed(3).padStart(6)} ${flight.copycatMiss.toFixed(3).padStart(8)} ${flight.worstMiss
                .toFixed(1)
                .padStart(6)}`,
            );
          }
        }
      }
      console.log("\nForecast range: how often the truth fell inside it (aim: about 80%)");
      for (const window of bench.WINDOWS) {
        const history = allReadings().filter((reading) => reading.sol <= window.toSol);
        for (const target of ["nightLowC", "sunlight"]) {
          const { inside, total } = rangeCoverage({ tools: ready }, history, target, 40);
          console.log(`  ${window.name.padEnd(18)} ${target.padEnd(10)} ${inside} of ${total} (${Math.round((100 * inside) / Math.max(1, total))}%)`);
        }
      }
    }
  }
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.stack : error);
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
