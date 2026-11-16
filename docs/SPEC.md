# SolCast: game spec

Working title; rename freely. Challenge: Build a Junior Astronaut Mission Trainer (2026 NASA Space Apps).
Submission closes **Sunday 15 November 2026, 11:59 p.m. local**. See [SUBMISSION.md](../SUBMISSION.md).

## The game in one line

Kids keep a four-person Mars outpost alive through real stretches of the Curiosity rover's record. Every Mars
day they choose how much solar energy to spend growing air and food and how much to save, and then the rover's
real measurements decide what happens to the crew.

## One sol (about a minute of play)

1. **Morning report.** Real data: today's sunlight (the rover's measured ultraviolet index, Low to Very High)
   and last night's low. Sunlight sets the energy the panels collect.
2. **The bet.** One slider: how much energy runs the greenhouse lights today. Air comes back the next sol. Food
   is a slow crop that needs about ten sols of light and dies after two sols without enough. Whatever is not
   spent stays in a small battery, which has to power the outpost all night and is the only reserve if tomorrow
   is dark.
3. **Huddle.** One emergency button: the crew moves into one room. Night power drops by more than half, but the
   greenhouse is off for the sol.
4. **Forecasts.** Mission Control sends a forecast every sol, made from data that is one sol old. The outpost
   computer makes its own from tools the player installs in the **Brain Bay**: Copycat, Averager, Season Memory,
   Trend Line. Each tool uses a little power, and the player can test one on sols it has not seen before
   installing it.
5. **Night.** The real measured low is revealed, and the crew visibly reacts.

Three gauges: **Battery, Air, Food**. Crew health is the fourth bar and ends the mission at zero.

## Missions

Each is a real stretch of the record. The start sol is picked from the seed, so it cannot be memorised.

| Mission | Real event | What it teaches |
|---|---|---|
| A calm season (12 sols) | Early 2016, steady Moderate sunlight | The loop, and keeping a reserve |
| Radio silence (30 sols) | Solar conjunction, August to September 2019. NASA stopped commanding its Mars missions for about two weeks. | Mission Control goes silent; the outpost computer is all you have |
| The great dust storm (34 sols) | The 2018 global dust storm | Sunlight collapses for weeks; reserve and Huddle decide who survives |

Measured on the real record (see `src/data/`):

- In the 2018 storm the rover's sunlight index went Very High, High, Moderate, then Low within about eight sols
  (sols 2075 to 2082) and stayed Low for more than five weeks.
- "Same as today" predicts tomorrow's sunlight level correctly on 92% of sols, and tonight's low within about
  0.5 C in a calm season and 2 C in the storm. No cleverer tool beats it in calm weather.
- In the storm, Season Memory is off by 7 C on the night low and wrong about sunlight nine sols in ten.

That is the honest lesson, and the game says it out loud: test a forecast before you trust it, and keep a
reserve for what no forecast can see.

Two facts quoted in the debrief still need a source link before we publish them:
Opportunity's solar energy falling from about 645 to 22 watt-hours a sol in June 2018, and the 2019 conjunction
dates. Find the NASA/JPL page for each and paste the link into `rules()` in `src/game/index.ts`. If we cannot
find one, cut the number and keep the sentence.

## What is real and what is a rule

Everything the game uses falls into one of three kinds, and the "How it works" page (from `game.rules()`)
labels each one:

- **NASA measurement:** sunlight index, overnight low, sol number, Earth date.
- **Physics:** a sol is 24.66 hours; heat leaks faster the bigger the temperature gap.
- **Game rule:** panel energy for each sunlight level, habitat size, battery size, air and crop numbers, tool
  power. All of them live in `src/game/rules.ts`.

Tapping a number in the UI shows its rule card. Data is archived, not live, and the footer says so.

## What independent judges said

Twelve separate reviews of four versions of this idea, each against the official rubric, scored it between
18 and 20.5 out of 25. They agreed on almost everything:

- **What earns points:** the real record is the opponent. You commit, then a real NASA measurement is revealed.
  Every reviewer said this would stand out.
- **What loses points:** anything that makes it look like a machine-learning lesson in a space costume; physics
  shortcuts; too many screens; a demo that does not show a child-level sol.
- **What a top demo must show:** one uncut sol, the storm arriving, the crew reacting, one number tapped through
  to its NASA source, and the debrief line.

So the outpost is the star and the Brain Bay is an upgrade bay. Do not lead the demo with the Brain Bay.

## Three parts

| Part | Owner | Builds | Folders it may edit |
|---|---|---|---|
| A. Brain | Avneh | The forecasting tools, how they are trusted, test flights | `src/brain/` |
| B. UI | (teammate) | Every screen, the crew, the art, sound | `src/app/`, `src/components/`, `public/` |
| C. Game | (teammate) | Missions, outpost rules, scoring, debrief, leaderboard, rules page | `src/game/` |

Shared and frozen: `src/contracts/`, `src/lib/`, `src/data/`, `scripts/`.

Dependencies run one way: **UI uses Game and Brain; Game uses Brain; Brain uses only data.** Nothing imports
from `src/app` or `src/components` except the UI itself.

Each part has its own brief: [PART-A-BRAIN.md](PART-A-BRAIN.md), [PART-B-UI.md](PART-B-UI.md),
[PART-C-GAME.md](PART-C-GAME.md).

## Working in parallel, with agents

The repo already contains a working reference for every part, so the game is playable end to end at `/play`
before anyone writes a line. Each owner replaces their part's insides without breaking the others.

1. **One branch per part:** `brain`, `ui`, `game`. Open a pull request to `main` when a piece works. CI runs
   lint and build on every pull request.
2. **Stay in your folders.** If your agent wants to edit a file outside them, stop it. The folders do not
   overlap, so merges never conflict.
3. **The contract is `src/contracts/index.ts`.** Read it first; give it to your agent first. To change it, post
   the exact change in the team chat, wait for two thumbs up, then change it in its own commit on `main` so
   everyone pulls it. Adding an optional field is safe; renaming or removing is not.
4. **Check before you push:** open `/play`, press "Run self-checks". Every line must say PASS. Then
   `npm run lint` and `npm run build`.
5. **Merge small and often.** Pull `main` into your branch at least every 30 minutes.

Prompt to give an agent at the start of a session:

> Read `docs/SPEC.md`, `src/contracts/index.ts` and `docs/PART-<X>-....md`. You own only the folders listed for
> Part <X>. Do not edit `src/contracts`. Keep `npm run lint` and `npm run build` passing and every self-check
> on `/play` green.

## Tonight

| Clock | Milestone |
|---|---|
| Now | Everyone pulls `main`, runs `npm install` and `npm run dev`, plays one mission at `/play` |
| 9:30 p.m. | First merge from each part. The real UI can play the calm mission. |
| 10:15 p.m. | Feature freeze. Only fixes after this. |
| 10:30 p.m. | Deploy to Vercel. Record the 30-second demo ([DEMO-SCRIPT.md](DEMO-SCRIPT.md)). |
| 11:00 p.m. | First "Submit for Judging" with the text from [PROJECT-PAGE.md](PROJECT-PAGE.md). |
| 11:30 p.m. | Final resubmit. Test every link in a private window. |

Must have tonight: the three missions playable in the real UI, crew that reacts, the reveal, tap-to-source on
the main numbers, the debrief, the footer credits, a deployed link, the demo.

Later: Advanced Lab tools, online leaderboard, a radiation shelter mission from NASA's solar particle records,
the perfect-hindsight plan, Spanish.
