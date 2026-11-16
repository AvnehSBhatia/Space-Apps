# Part C: the game

Folder: `src/game/`. Contract: `GameApi` in `src/contracts/index.ts`.

You own the missions, the rules of the outpost, scoring, the debrief, the "How it works" cards and the
leaderboard. The UI calls `game.start()`, sends actions to `game.reduce()`, and draws whatever `GameState` says.

## What exists now

`src/game/index.ts` and `src/game/rules.ts` are a working reference that passes every self-check.

**The sol loop** (`Phase`): `report` (morning data) → `bet` (the player decides) → `night` (the real low is
revealed) → next sol, or `ended`.

**Actions:** `setDesign`, `goToBet`, `setBet`, `lockBet`, `nextSol`, `fastForward`. An action that is not
allowed returns the same state with `problem` set to a sentence the player can read.

**One sol, in order:**

1. Solar energy for today comes from the real sunlight level (`RULES.SOLAR_WH`).
2. Battery at sunset = battery + solar − computer − greenhouse, capped at the battery size. Extra is lost.
3. Night power = 3.5 kWh + 90 Wh for each degree the real low is below 20 C. Huddle multiplies it by 0.45.
4. If the battery cannot cover the night, the crew is cold for the uncovered share of the night.
5. Air: minus 10 points a sol, plus 2 points for each kWh of greenhouse light.
6. Crop: collects greenhouse light; harvested at 60 kWh for 40 meals; dies after two sols under 2 kWh.
7. Crew eats 4 meals a sol.
8. Health: minus 4 for each cold hour (at most 40), minus half a point for each air point under 30, minus 4
   when hungry; plus 3 on a good sol.

**Missions:** `calm2016` (12 sols), `conjunction2019` (30 sols, blackout on rover sols 2509 to 2519),
`dust2018` (34 sols). The start sol is picked from the seed within a small window.

**Forecasts:** Mission Control uses all four core tools on data that is one sol old, and is null during a
blackout. The outpost forecast uses the player's installed tools and is null when none is installed.

**Fast-forward:** replays the same bet on later sols and stops when the sunlight or contact changes, a gauge
reaches a warning, a crop is harvested or dies, a night goes cold, or the mission ends.

## Balance right now

Four fixed strategies, seed 2 (`playWith()` in `src/game/index.ts`):

| Mission | Careful commander | Spend everything | Spend half | Spend nothing |
|---|---|---|---|---|
| Calm | survives, 600 | lost on sol 8 | survives, 600 | lost on sol 12 (no air) |
| Conjunction | survives, 760 | lost on sol 9 | survives, 760 | lost on sol 12 |
| Dust storm | survives, 820 | lost on sol 27 | lost on sol 29 | lost on sol 12 |

The careful commander keeps two nights of battery, planning for a night 3 C colder than the last one, and
huddles when sunlight is Low and air is above 45. No strategy that ignores the data wins the storm, and
hoarding always loses. Keep both of those true. The self-checks now test the careful commander and greedy play
on **every** start sol a seed can pick, not just seed 2. Run the table yourself with `src/game/bench.ts`.

What changed after C1/C2 (15 November):

- **Dust storm start window 2056–2064 → 2056–2060.** Sunlight goes Low on sol 2082 and stays Low, so a late
  start put up to 16 Low sols in the mission and even the careful commander died on seeds 7 and 8. Now there
  are 8 to 12 Low sols, and the careful commander survives on every seed (650 to 940).
- **Starting meals 24 → 36.** With 24, every strategy went hungry around sol 7, before any crop could be
  harvested. 36 reaches the first harvest; 40 let "spend nothing" survive the calm mission, so it stops at 36.
- **Careful commander plans 3 C colder (`CAREFUL_MARGIN_C`).** It used to end a few hundred Wh short of a spare
  night. Conjunction is now a tie with "spend half" on every seed instead of a 20-point loss.

## Crew (for Part B)

Exported as `CREW` from `src/game`: **Ravi** (commander), **Mina** (botanist), **Theo** (engineer), **Zara**
(doctor). The story lines rotate through all four.

## Also exported from `src/game` for Part B

- `leaderboard` (the `LeaderboardApi`, on `localStorage` key `solcast.leaderboard.v1`), `entryFor(state,
  callSign, classCode, at)`, `makeCallSign(seed)`, `missionCode(state)`, `parseMissionCode(text)`.
- New rule card ids: `sol-date`, `battery`, `food`, `health`, `forecast`, `conjunction`, `opportunity`,
  `score` (plus the original `sunlight`, `solar`, `nightLow`, `keepAlive`, `huddle`, `air`, `crop`,
  `mars-day`).

## Tonight, in order

1. **C1. Play all three missions at `/play`.** Write down anything that feels unfair or dull.
2. **C2. Tune.** Every number is in `src/game/rules.ts`. Targets: a first-time nine-year-old survives the calm
   mission; "spend half" should not beat the careful commander on conjunction (it does now, by 20 points);
   the storm is won by reserve plus two to four well-timed huddles. Re-run the table above after each change
   and keep the two balance self-checks passing.
3. **C3. Story lines.** `SolOutcome.story` is what the night screen says. Make each line short, physical and
   kind, reading age about nine. Give the four crew names and use them ("Ravi's hands are cold").
   Tell Part B the names.
4. **C4. Debrief.** Lead with physical facts, never a percentage: spare nights when the sky went dark, cold
   nights, meals harvested, lowest air. For the dust storm, keep the Opportunity line. End every mission with
   one sentence naming the trade the player made.
5. **C5. Rule cards.** `rules()` feeds the "How it works" page and tap-to-source. Every number on a screen needs
   a card id. Add the source links listed in `docs/SPEC.md` once found.
6. **C6. Leaderboard.** Implement `LeaderboardApi` in `src/game/leaderboard.ts` on top of `localStorage`, with a
   generated call sign (two friendly words and a number, never a real name: players may be children). The
   mission code a class shares is `<missionId>-<seed>`. An online board is later.
7. **C7. Guided mode.** In `guided` mode no tools are available and the first three sols of the calm mission
   should carry a hint in `story` ("Try keeping two nights of battery").

Later: the perfect-hindsight plan (dynamic programming over the battery, air and crop state), a radiation
shelter mission that reuses Huddle and is driven by NASA's solar particle records, light-time delay on
messages.

## Promises you must keep (from the contract)

- `reduce()` is pure and never throws.
- The real low for today never appears in `GameState` before the phase is `night`.
- Same mission, seed and mode give the same game.
- `GameState` survives `JSON.stringify` and `JSON.parse`.

## Done when

- Every game self-check on `/play` says PASS.
- `npm run lint` and `npm run build` pass.
- The balance table above is updated.
