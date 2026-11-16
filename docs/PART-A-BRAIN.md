# Part A: the brain

Owner: Avneh. Folder: `src/brain/`. Contract: `BrainApi` in `src/contracts/index.ts`.

The brain is the outpost computer's forecasting engine. The game asks it two questions every sol: how cold
will tonight get, and how sunny will tomorrow be. The UI shows its tools in the Brain Bay.

## What exists now

`src/brain/index.ts` is a working reference that passes every self-check:

- **Four core tools:** Copycat (last reading), Averager (mean of the last N readings), Season Memory (the same
  sol one Mars year, 668 sols, earlier), Trend Line (a least-squares line through the last N readings, followed
  one step).
- **Trust:** the brain blends its tools, weighting each by how close it has been over the last 120 sols
  (inverse mean squared error). `TrainedBrain.trust` holds the weights; they sum to 1.
- **Range:** the 10th and 90th percentiles of the blend's recent misses, added to the forecast.
- **Test flight:** walks forward over the last N sols, training only on earlier sols each time, and reports the
  average miss, its noise, Copycat's miss on the same sols, and how much each tool helps (the brain's miss
  without the tool, minus its miss with it).
- **Two targets:** `"nightLowC"` (degrees C) and `"sunlight"` (level 1 to 4 from the rover's ultraviolet index).

Three Advanced Lab tools are in the catalog with `ready: false`. They behave as Copycat until you build them.

## What the reference measures on the real record

All four tools installed, 30 to 60 sol test flights:

| Stretch | Target | Brain miss | Copycat miss | Notes |
|---|---|---|---|---|
| Calm 2016 | night low | 0.52 C | 0.50 C | Season Memory hurts slightly |
| Calm 2016 | sunlight | 0.04 levels | 0.00 | |
| Dust storm 2018 | night low | 2.08 C | 2.07 C | Worst miss 8 C |
| Dust storm 2018 | sunlight | 0.28 levels | 0.10 | Season Memory hurts by 0.15 |
| Conjunction 2019 | night low | 0.74 C | 0.78 C | Averager helps by 0.11 C |

The blend does not beat Copycat by much anywhere. That is a true result, and the game is built around it.
Do not tune the numbers to make the tools look better than they are.

## Promises you must keep (from the contract)

- Pure and deterministic. No `Math.random`, no `Date`, no network. Use `createRng(seed)` from `src/lib/rng.ts`
  for anything random, such as weight initialisation.
- Read only the `history` you are given. It can contain null readings and missing sols.
- `train()` and `testFlight()` finish within 150 ms on 1,000 sols.
- An empty design behaves as Copycat. Nothing throws; nothing returns NaN.
- `TrainedBrain` survives `JSON.stringify` and `JSON.parse`.

## Tonight, in order

1. **A1. Play one mission at `/play` in builder mode** and run a test flight, so you have seen what the UI and
   the game do with your output.
2. **A2. Better trust.** Replace inverse-error weighting with non-negative least squares on the training window
   (weights at or above 0, summing to 1). Keep it only if the test-flight miss drops on all three missions.
3. **A3. Check the range.** Add a self-check that the true value falls inside low-to-high on 75 to 85% of
   test-flight sols. If it does not, widen or narrow the percentiles.
4. **A4. Hit/miss data for the UI.** The UI wants a scoreboard per tool ("right 9 of the last 10 sols"). The
   data is already in `preview()`; confirm with Part B that they have what they need, and tell them what counts
   as a hit: within 2 C for the night low, the exact level for sunlight.
5. **A5. Long Memory**, the first Advanced Lab tool: exponential smoothing with a level and a trend (Holt's
   method), which is a two-state linear state-space model. Fit the two smoothing constants by grid search on
   the training window. Set `ready: true` when its self-check passes.
6. **A6. Spotlight:** attention over the past. Take the last k readings, compare them with every k-length
   window in the training window, weight each by `softmax(-distance^2 / temperature)`, and predict the last
   reading plus the weighted average of what came next in each window. Fit the temperature by grid search.
7. **A7. Neuron Pack:** inputs are the last k readings, standardised; one hidden layer of tanh units; the output
   is added to the last reading. Full-batch gradient descent, 200 steps, seeded initialisation.

A5 to A7 are only visible in lab mode. They are not needed for the submission; build them after A1 to A4 work
and only if there is time. The ladder you wanted, from simple rules to attention to state-space models, lives
here, and rotary attention and selective state-space blocks are the next rungs after the hackathon.

## Adding a tool

1. Add its `ToolInfo` to `CATALOG` (kid name, grown-up name, a one-sentence blurb a nine-year-old can read,
   power, knobs).
2. Add a `case` in `guessAt()`. It receives the series and the position to predict, and must use only
   positions before it.
3. If it needs fitted numbers, fit them inside `guessAt()` from the training window, or cache them in
   `TrainedBrain.internals` keyed by the tool's `uid`.
4. Add a self-check: finite output, deterministic, within the time limit.

## Done when

- Every brain self-check on `/play` says PASS.
- `npm run lint` and `npm run build` pass.
- The table above is updated with your numbers.
