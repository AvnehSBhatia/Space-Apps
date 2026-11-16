# Part A: the brain

Owner: Avneh. Folder: `src/brain/`. Contract: `BrainApi` in `src/contracts/index.ts`.

The brain is the outpost computer's forecasting engine. The game asks it two questions every sol: how cold
will tonight get, and how sunny will tomorrow be. The UI shows its tools in the Brain Bay.

## What exists now

The engine, four core tools and three Advanced Lab tools are built. All seven tools are `ready: true`, and
`npm run check` passes.

### Files

| File | What it is for |
|---|---|
| `index.ts` | The engine. Exports `brain`, which implements `BrainApi`: `catalog`, `energy`, `train`, `predict`, `testFlight`, `preview`, `selfCheck`. Also exports `rangeCoverage`, which `npm run check` uses. |
| `core.ts` | Shared pieces: the `Series` type, `toSeries`, the helpers tools use (`recent`, `readings`, `mean`, `knobOf`, `withinReach`), and the `ToolModule` type with the rules every tool follows. |
| `trust.ts` | How much the brain trusts each tool (`learnTrust`) and how it blends their guesses (`blend`). |
| `range.ts` | How wide the forecast range is (`learnRange`). |
| `bench.ts` | The checks every tool must pass (`standardChecks`) and how one tool does alone on the real record (`benchTool`). |
| `scoreboard.ts` | A hit-or-miss row for one tool, for the UI. |
| `tools/index.ts` | The list of every tool, in catalog order. |
| `tools/<id>.ts` | One file per tool. |

### Tools

| Tool | Grown-up name | What it does | Knob | Energy a sol |
|---|---|---|---|---|
| Copycat | persistence forecast | Repeats the newest reading. | none | 0 Wh |
| Averager | moving average | The mean of the last N readings. | N, 2 to 14, starts at 5 | 150 Wh |
| Season Memory | seasonal forecast | The same sol one Mars year (668 sols) earlier, or the nearest sol within 2 if the rover sent nothing that sol. With neither, the newest reading. | none | 250 Wh |
| Trend Line | linear trend | A least-squares line through the last N readings, followed one sol. | N, 3 to 10, starts at 5 | 300 Wh |
| Long Memory | state-space model | Advanced Lab. Holt's smoothing: a level and a trend that fade slowly. | none | 700 Wh |
| Spotlight | attention | Advanced Lab. Finds earlier stretches shaped like the last few sols and copies what came next. | sols to compare, 3 to 10, starts at 5 | 1,100 Wh |
| Neuron Pack | neural network | Advanced Lab. A small network that learns the next change from the last few readings. | neurons, 2 to 16, starts at 4 | 900 Wh |

The three Advanced Lab tools are only visible in lab mode. How each one works:

- **Long Memory.** Exponential smoothing with a level and a trend (Holt's method), which is a two-state linear
  state-space model. `fit()` tries 10 values of the level constant (0.1 to 1.0) with 5 of the trend constant
  (0 to 0.4) and keeps the pair with the smallest squared one-step miss over the training window. It starts
  from 0.8 and 0.1 and only changes them for a pair that does strictly better. `guess()` runs the smoother over
  the last 160 sols and steps one sol ahead.
- **Spotlight.** It takes the last k readings as a shape (each reading measured from the newest one) and
  compares that shape with every earlier k-reading stretch in the last 160 sols. Each stretch gets the weight
  `softmax(-distance / temperature)`, where the distance is the mean squared difference between the two
  shapes. The guess is the newest reading plus the weighted average of the change that followed each stretch.
  `fit()` picks the temperature from 8 candidates by guessing the newest 40 readings of the training window.
- **Neuron Pack.** The inputs are the 4 readings before the newest one, written as changes from the newest and
  divided by the typical one-sol change. One hidden layer of tanh units, one output: the next change, which is
  added to the newest reading. Training is full-batch gradient descent, 90 steps, from a seeded start, so the
  same seed gives the same weights. With fewer than 20 worked examples it acts as Copycat.

A tool with no reading to go on makes no guess, and the brain leaves it out of the blend. The same happens to a
tool that throws an error or returns something that is not a number.

### Trust

`train()` looks at the last 160 sols of the history it is given.

1. Every tool that learns is fitted on the older part of that window.
2. The newest 40 sols are held back. Each tool guesses each of them, using only what it learned in step 1 and
   the readings before that sol. A tool cannot earn trust by memorising, because it never learned from these
   sols. (With fewer than 80 sols, the newer half is held back instead.)
3. Each tool's trust is in proportion to 1 / (its mean squared miss on the held-back sols + 0.05). The shares
   are scaled to add up to 1. `TrainedBrain.trust` holds them, in design order.
4. Every tool is fitted again on the whole window, ready to forecast.

Weights fitted by least squares were tried in place of step 3. They made the core tools' night-low blend
worse, so the simpler rule stayed.

### Range

The forecast's `low` and `high` come from the blend's own misses on the held-back sols (truth minus guess).
For n misses the low end is the floor((n + 1) x 0.1)-th smallest and the high end is the
ceil((n + 1) x 0.9)-th smallest, so the range should hold the truth about 8 times in 10. Each side of the
night-low range is at least 0.5 C, so a lucky quiet stretch cannot make it too thin. With fewer than 10 misses
the range is plus or minus 4 C for the night low and plus or minus 1 level for sunlight. Sunlight forecasts
stay between 1 and 4.

### Test flights

`testFlight()` walks forward over the last N sols. It learns only from the sols before the one it is guessing,
and learns again every 10 sols. It needs at least 30 earlier sols. It reports:

- `averageMiss`: the average distance between guess and truth.
- `missNoise`: how far that average could be off by chance (one standard error).
- `copycatMiss`: the miss of "same as last time", counted on exactly the same sols.
- `worstMiss`, `energyWhPerSol` and the guess for every sol (`points`).
- `toolHelp`: for each tool, the brain's miss without it minus its miss with it. Positive means the tool helps.

`preview()` gives one tool's guesses over the last N sols, for a chart. A tool that learns is fitted once, on
the 160 sols before the previewed stretch.

### Scoreboard, for the UI

`src/brain/scoreboard.ts` turns a preview into a hit-or-miss row ("right 9 of the last 10 sols"):

```ts
import { scoreboard } from "@/brain/scoreboard";

const { marks, hits, played } = scoreboard(tool, state.history, "nightLowC", 10);
```

`marks` has one entry per sol, oldest first: `{ sol, hit }`, where `hit` is true, false, or null when the rover
sent no reading or the tool had no guess. `played` counts the sols that could be marked. A night-low guess is a
hit within 2 C. A sunlight guess is a hit when it rounds to the real level. Nothing outside `src/brain` uses
this yet.

### `npm run check`

- `npm run check` runs `brain.selfCheck()` and the game's self-checks outside the browser, then prints how
  each ready tool does alone, how the blended brain does, and how often the truth fell inside the forecast
  range. It exits 1 if anything fails.
- `npm run check -- --tool longMemory` compiles and checks one tool alone, so a half-finished tool in another
  file cannot get in the way.

`brain.selfCheck()` is the same list `/play` shows. It has 17 engine checks, then 11 standard checks for every
ready tool, then each tool's own checks. It is not instant, so run it from a button, as `/play` does.

## What it measures on the real record

Every number below is copied from the output of `npm run check`. The three stretches are the ones the game is
played on: calm 2016 (sols 1227 to 1256), dust storm 2018 (sols 2062 to 2121) and conjunction 2019 (sols 2495
to 2534). A miss is the average distance between guess and truth. Lower is better.

### Each tool alone

Each tool walks forward over the stretch on its own, learning again every 10 sols from the 160 sols before.

Night low, miss in degrees C:

| Tool | Calm 2016 | Dust storm 2018 | Conjunction 2019 |
|---|---|---|---|
| Copycat | 0.500 | 2.067 | 0.775 |
| Averager | 0.593 | 2.353 | 0.665 |
| Season Memory | 2.267 | 7.167 | 1.750 |
| Trend Line | 0.537 | 2.450 | 0.848 |
| Long Memory | 0.595 | 2.469 | 0.659 |
| Spotlight | 0.563 | 2.086 | 0.687 |
| Neuron Pack | 0.575 | 2.086 | 0.677 |

Sunlight, miss in levels:

| Tool | Calm 2016 | Dust storm 2018 | Conjunction 2019 |
|---|---|---|---|
| Copycat | 0.000 | 0.100 | 0.000 |
| Averager | 0.000 | 0.213 | 0.000 |
| Season Memory | 0.200 | 1.633 | 0.900 |
| Trend Line | 0.000 | 0.203 | 0.000 |
| Long Memory | 0.000 | 0.203 | 0.000 |
| Spotlight | 0.041 | 0.132 | 0.000 |
| Neuron Pack | 0.011 | 0.162 | 0.000 |

### The blended brain

`brain.testFlight()` over each stretch (the last 30, 60 and 40 sols of the record up to its end), seed 1.
"Core 4" is Copycat, Averager, Season Memory and Trend Line. "All ready" adds the three Advanced Lab tools.

| Stretch | Target | Design | Miss | Give or take | Copycat | Worst miss |
|---|---|---|---|---|---|---|
| Calm 2016 | night low | core 4 | 0.549 C | 0.078 | 0.500 C | 2.0 C |
| Calm 2016 | night low | all ready | 0.536 C | 0.081 | 0.500 C | 1.8 C |
| Calm 2016 | sunlight | core 4 | 0.044 levels | 0.017 | 0.000 | 0.2 |
| Calm 2016 | sunlight | all ready | 0.032 levels | 0.009 | 0.000 | 0.1 |
| Dust storm 2018 | night low | core 4 | 2.098 C | 0.233 | 2.067 C | 8.1 C |
| Dust storm 2018 | night low | all ready | 2.096 C | 0.234 | 2.067 C | 8.5 C |
| Dust storm 2018 | sunlight | core 4 | 0.257 levels | 0.034 | 0.100 | 1.2 |
| Dust storm 2018 | sunlight | all ready | 0.211 levels | 0.036 | 0.100 | 1.2 |
| Conjunction 2019 | night low | core 4 | 0.746 C | 0.101 | 0.775 C | 2.3 C |
| Conjunction 2019 | night low | all ready | 0.688 C | 0.089 | 0.775 C | 2.2 C |
| Conjunction 2019 | sunlight | core 4 | 0.017 levels | 0.001 | 0.000 | 0.0 |
| Conjunction 2019 | sunlight | all ready | 0.009 levels | 0.000 | 0.000 | 0.0 |

### The forecast range

How often the truth fell inside low-to-high over the 40 sols that end each stretch, with every ready tool
installed and the brain trained again for each sol on only the sols before it. The aim is about 80%.

| Stretch | Night low | Sunlight |
|---|---|---|
| Calm 2016 | 36 of 40 (90%) | 40 of 40 (100%) |
| Dust storm 2018 | 29 of 40 (73%) | 39 of 40 (98%) |
| Conjunction 2019 | 32 of 40 (80%) | 40 of 40 (100%) |

### What the numbers say

- **Copycat is very hard to beat.** Night lows move little from one sol to the next, and the sunlight level
  rarely changes at all.
- **Night low.** No tool beats Copycat on calm 2016 or on the dust storm. On conjunction 2019, Long Memory
  (0.659), Averager (0.665), Neuron Pack (0.677) and Spotlight (0.687) beat Copycat (0.775). Trend Line and
  Season Memory do not beat it anywhere.
- **Sunlight.** No tool beats Copycat on any stretch. The best a tool does is tie it at 0.000.
- **The blend** beats Copycat only on the conjunction 2019 night low: 0.746 C with the core 4 and 0.688 C with
  all ready tools, against 0.775 C. The gain with all tools, 0.087 C, is about the size of the blend's own
  give or take (0.089 C), so 40 sols are too few to be sure of it. On every other row the blend is worse than
  Copycat. For the night low it is worse by less than its give or take. For sunlight it is worse on all three
  stretches, most on the dust storm (0.211 against 0.100 levels).
- **Adding the Advanced Lab tools** lowers the blend's miss on every row of the table. For the night low the
  gain is largest on conjunction 2019 (0.746 to 0.688 C) and smallest on the dust storm (2.098 to 2.096 C).
  Every night-low gain is smaller than the give or take, so none of them is a sure thing. The worst miss on
  the dust storm goes up, from 8.1 to 8.5 C.
- **The night-low range** holds the truth 90%, 73% and 80% of the time. The dust storm is below the aim, most
  likely because the weather there changes faster than the 40 held-back sols can show.
- **The sunlight range** holds the truth 98% to 100% of the time, more often than 8 in 10. On calm 2016 and
  conjunction 2019 the level did not change at all (Copycat's miss is 0.000), so any range holds it.

These are true results, and the game is built around them. Do not tune the numbers to make the tools look
better than they are.

## Promises kept (from the contract)

Each promise below has a self-check.

- **Pure and deterministic.** No `Math.random`, no `Date`, no network. Neuron Pack takes its starting weights
  from `createRng(seed)` in `src/lib/rng.ts`. The same inputs and seed give the same output.
- **Reads only the `history` it is given**, and never the sol being guessed or a later one. The checks change
  those sols and confirm that no guess, fit, test flight or preview moves.
- **Null readings and missing sols** are handled. A reading that is not a real number, or is 1,000,000 or
  more either way, counts as missing.
- **Fast.** `train()` and `testFlight()` finish within 150 ms on 1,000 sols. The check times them with every
  ready tool at its slowest knob setting. Each tool on its own is also timed, with its knobs as they start:
  `fit()` must average under 3 ms and `guess()` under 0.05 ms.
- **An empty design behaves as Copycat alone**, with `trust: []`.
- **Never throws on valid input, never returns NaN or Infinity.** This holds for odd designs too: unknown tool
  ids, the same tool twice, knobs that are out of range or missing.
- **`TrainedBrain` survives `JSON.stringify` and `JSON.parse`**, and gives the same forecast afterwards. A
  damaged or older save still gives a valid forecast.
- **`low <= value <= high`** in every forecast, and sunlight stays within 1 to 4.
- **`trust`** has one share per tool, in design order, each 0 to 1, adding up to 1.
- **`catalog()` returns copies**, so a caller cannot change the engine's tools.

## Tonight's list, where it stands

- **A1. Play one mission at `/play`.** For a person to do. Nothing here replaces it.
- **A2. Better trust.** Tried and not kept, as described under Trust.
- **A3. Check the range.** Done. The self-check accepts 65% to 95% for the night low. The 75% to 85% first
  planned would fail on two of the three stretches (90% and 73%).
- **A4. Hit/miss data for the UI.** Done in `scoreboard.ts`. Part B still has to confirm it is what they need.
- **A5 to A7. Long Memory, Spotlight, Neuron Pack.** Built, checked and `ready: true`.

## Adding a tool

Each tool is one file. Look at `src/brain/tools/trend.ts` for a small one and `longMemory.ts` for one that
learns.

1. Add the tool's id to `ToolId` in `src/contracts/index.ts`. That file is shared, so post the change in the
   team chat first.
2. Create `src/brain/tools/<id>.ts`. It exports one `ToolModule` named after the id, with:
   - `info`: kid name, grown-up name, a one-sentence blurb a nine-year-old can read, energy a sol, knobs,
     `learns`, `advanced`, and `ready: false` for now.
   - `guess(context)`: the guess for position `end`. It may read only positions before `end`. Return null
     only when there is no earlier reading to go on.
   - `fit(context)`, if the tool learns: it may read only positions `from <= p < end`, and returns plain JSON.
     `guess()` receives it back as `params` after a JSON round trip, and must cope with any `params`, because
     an old save file may hold anything. Set `learns: true` exactly when the tool has a `fit()`.
   - `checks()`, if you can: a few checks of the tool's own, such as a steady series giving its own value.
3. Follow the rules written above `ToolModule` in `src/brain/core.ts`: pure and deterministic, no state that
   changes between calls, `fit()` depends on the knobs and never the `uid`, nothing changes the series or
   `params`. Read knobs with `knobOf()` and use `createRng(seed)` for anything random.
4. Add the tool to `TOOLS` in `src/brain/tools/index.ts`.
5. Run `npm run check -- --tool <id>`. It runs the standard checks and the tool's own, and prints how the tool
   does alone next to Copycat with its average `fit()` and `guess()` times.
6. Set `ready: true` only when that passes. Then run `npm run check`, `npm run lint` and `npm run build`.
7. Add the tool's rows to the tables above, copied from the check output. Say so plainly if it does not beat
   Copycat.

## Next

The ladder from simple rules to attention to state-space models stops at Long Memory, Spotlight and Neuron
Pack. The next rungs, for after the hackathon:

- **Rotary attention.** Attention that also knows how many sols apart two readings are. Spotlight only
  compares shapes.
- **Selective state-space blocks.** A state-space memory whose constants depend on the input, so it can choose
  what to keep and what to forget. Long Memory has two fixed constants.
- **Trust.** A mix of least-squares weights and the present rule might be worth trying.
- **Range.** A range that widens quickly when the weather changes, for stretches like the dust storm.
- **A speed check at the slowest knob setting** for each tool on its own. Today only the engine check does that.

## Done when

- Every brain self-check says PASS. `npm run check` runs the same list `/play` shows.
- `npm run lint` and `npm run build` pass.
- The tables above match the output of `npm run check`.
