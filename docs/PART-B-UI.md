# Part B: the UI

Folders: `src/app/`, `src/components/`, `public/`. Contracts: `GameState`, `Action`, `SolOutcome`, `WhatIf`,
`RuleCard`, `ToolInfo`, `TestFlight` in `src/contracts/index.ts`.

You build everything the player sees. The game should feel like a friendly kids' learning adventure: bright,
chunky, full of character, in the spirit of the learning RPGs kids already love. It must be **our own look**:
original characters, art and logo. Do not copy any existing game's characters, art, name or interface.

## How the UI talks to the game

```tsx
const [state, dispatch] = useReducer(game.reduce, undefined, () => game.start("calm2016", seed, "guided"));
dispatch({ type: "goToBet" });
dispatch({ type: "setBet", bet: { greenhouseWh: 6000, huddle: false } });
dispatch({ type: "lockBet" });      // reveals the real night
dispatch({ type: "nextSol" });      // or { type: "fastForward" }
```

- Draw whatever `state` says. `state.phase` decides which panel shows: `report`, `bet`, `night`, `ended`.
- **Never calculate a game rule in the UI.** Every number comes from `GameState`, `SolOutcome`,
  `game.whatIf(state, bet, nightLowC)`, `game.debrief(state)` or `game.rules()`.
- When `state.problem` is not null, show it as a friendly message.
- Save `JSON.stringify(state)` to `localStorage` under `solcast.save.v1` after every action, inside try/catch,
  and offer "Continue" on the home screen.
- Brain Bay: `brain.catalog()` for the tool cards, `dispatch({ type: "setDesign", design })` to install or
  remove, `brain.testFlight(design, state.history, target, 30, state.seed)` for a test flight,
  `brain.preview(tool, state.history, target, 10)` for a hit/miss row.

`src/app/play/page.tsx` is a plain working harness that does all of this already. Read it first, keep it as
`/play` for testing, and build the real game at `/` and `/mission`.

## Screens, in build order

1. **Outpost** (the game). Top: sol counter with the real Earth date, a sky that shows today's sunlight.
   Middle: a cutaway of the habitat with the four crew. Sides or top: the three gauges (Battery, Air, Food with
   its crop bar) and the crew health bar. Bottom: one panel that changes with the phase.
   - **Report panel:** "Sunlight today: High. The panels collect 24 kWh." Last night's real low. Mission
     Control's forecast, or a "No signal from Earth" card during a blackout. Button: "Plan the day".
   - **Bet panel:** one large slider for greenhouse light. As it moves, show live from `game.whatIf`: the
     battery at sunset, "covers nights down to −82 C" as a marker on a thermometer, the forecast range as a band
     on the same thermometer, air after, crop after. One big Huddle toggle. Button: "Lock it in".
   - **Night panel:** a short pause, then the thermometer drops to the real low with a "Real data" stamp and
     the source ("Curiosity rover, sol 2085, 20 June 2018"). The crew reacts. Show `outcome.story`. Buttons:
     "Next sol" and "Fast-forward".
2. **Mission select.** Three mission cards from `game.missions()`, an age choice ("7 to 9" starts `guided`,
   "9 to 12" starts `builder`), and a box to type a mission code (`<missionId>-<seed>`).
3. **Debrief** (`phase === "ended"`). `game.debrief(state)`: headline, the lines, your score beside the careful
   commander's, the mission code to share, "Play again".
4. **Tap to source.** Wrap every number in a small component that takes a rule id and opens that `RuleCard`:
   title, the plain sentence, the formula, a badge for "NASA measurement", "physics" or "game rule", and the
   source. Rule ids today: `sunlight`, `solar`, `nightLow`, `keepAlive`, `huddle`, `air`, `crop`, `mars-day`.
   A "How it works" page lists every card.
5. **Brain Bay** (only when `state.availableTools.length > 0`). A drawer or second tab, never the first thing
   the player sees. Tool cards with the kid name large and the grown-up name small, the power it uses, an
   install toggle, a hit/miss row for the last ten sols, and a "Test flight" button that says, for example,
   "Off by 0.7 C, give or take 0.1. Copycat alone: 0.8 C."
6. **Home.** Title, one sentence, a large Play button, Continue, How it works, and the data credits footer
   (`src/components/data-credits.tsx`, keep it on every screen).

## The crew

Four characters, names from Part C. Build them from simple SVG shapes so their states can be animated in CSS.
Pick the state from the last outcome:

| State | When | Look |
|---|---|---|
| Happy | a good sol | small bounce, smile |
| Cold | `hoursCold > 0` | shiver, blue tint, breath puffs |
| Tired | `outpost.airPercent < 40` | slow blink, drooping |
| Hungry | `outpost.meals < 8` | thought bubble with a plate |
| Cheering | `mealsHarvested > 0` | arms up, confetti |
| Huddled | `bet.huddle` | all four in one room under a blanket |

When the crew is lost the game says they were evacuated. Nobody dies on screen.

## Art direction

- **Mood:** bright, warm, adventurous. Setbacks are gentle and always explain what to try next.
- **Shapes:** chunky rounded rectangles (20 to 28 px corners), 3 to 4 px dark outlines, flat fills with one
  soft highlight, and a solid offset shadow under buttons and cards so they look pressable.
- **Colours:** space navy `#101436` (background), panel indigo `#23295A`, cream `#FFF6E5` (cards), ink
  `#1B1F3B` (text and outlines), Mars orange `#FF7A3D` (primary), sun yellow `#FFD23F`, air mint `#3DDC97`,
  battery blue `#4CC9F0`, leaf green `#8BD450`, berry `#EF476F` (danger).
- **The sky shows the data:** Very High is clear peach, High is light orange, Moderate is dusty rose, Low is a
  brown haze with drifting dust.
- **Type:** Baloo 2 (700 and 800) for titles and buttons, Nunito (600 and 700) for text, both through
  `next/font/google`. Body text at least 18 px; numbers in tabular figures.
- **Buttons:** at least 56 px tall. One primary action per panel, full width on phones. Pressing moves the
  button down 4 px and shrinks its shadow.
- **Motion:** gauges spring to their new value in 300 to 500 ms, numbers count up, confetti on a harvest, a
  1.5 second pause before the night reveal. Honour `prefers-reduced-motion`.
- **Words:** reading age about nine. Sentences of twelve words or fewer. Explain "sol" the first time ("a sol
  is one day on Mars"). Show energy as battery bars with the number beside them.
- **Access:** every status uses a colour, an icon and a word. Text contrast at least 4.5 to 1. Visible focus
  rings. The slider works with arrow keys and Enter locks the bet. Touch targets at least 48 px. Lay out for
  360 px wide phones and for 1366 × 768 school laptops.

## Rules for assets (from the Space Apps guide)

- Any image or video made with an AI tool needs a **visible watermark** saying so. AI-made audio must be
  acknowledged in its description and metadata. Log every AI use in `AI_USE.md`.
- No NASA logos, flags or mission patches anywhere.
- No photos, video, voices or likenesses of anyone under 18.

## Tonight, in order

1. **B1.** The Outpost screen with real state: gauges, report, bet with live preview, night reveal.
2. **B2.** The crew and their states.
3. **B3.** Mission select and debrief.
4. **B4.** Tap to source and the How it works page.
5. **B5.** Brain Bay.
6. **B6.** Home screen, motion, polish.

Cut from the bottom if time runs short. B1 to B4 are what the demo needs.

## Prompt for a UI agent

> You are building the UI for SolCast, a browser game for ages 7 to 12. Read `docs/SPEC.md`,
> `docs/PART-B-UI.md`, `src/contracts/index.ts` and `src/app/play/page.tsx`. Edit only `src/app`,
> `src/components` and `public`. Never compute game rules in the UI: every number comes from `GameState`,
> `SolOutcome`, `game.whatIf`, `game.debrief` or `game.rules`. Follow the art direction exactly, with original
> characters and art. Use Tailwind and inline SVG, with no new dependencies unless asked. Keep `npm run lint`
> and `npm run build` passing.

## Done when

- A new player can finish the calm mission without reading any instructions outside the screen.
- The dust storm shows the sky darkening, the crew reacting, and the real low revealed with its source.
- Every number on the Outpost screen opens its rule card.
- `npm run lint` and `npm run build` pass, and the layout holds at 360 px and 1366 px wide.
