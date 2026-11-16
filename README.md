# SolCast

Our entry for the **2026 NASA Space Apps Challenge**, challenge
[Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/).

Kids aged 7 to 12 keep a four-person Mars outpost alive through real stretches of the Curiosity rover's weather
record. Every Mars day they choose how much solar energy to spend growing air and food and how much to save,
and then the rover's real measurements decide what happens to the crew. It runs in a browser with no download
and no account.

**Play it: https://solcast-mars.vercel.app**

**Submission closes Sunday 15 November 2026 at 11:59 p.m. local time.** See [SUBMISSION.md](SUBMISSION.md).

## Start here

| Read | For |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | The game, the three parts, how we work in parallel, tonight's timeline |
| [src/contracts/index.ts](src/contracts/index.ts) | The contract every part builds against |
| [docs/PART-A-BRAIN.md](docs/PART-A-BRAIN.md) | Part A: forecasting tools (`src/brain`) |
| [docs/PART-B-UI.md](docs/PART-B-UI.md) | Part B: screens, crew, art direction (`src/app`, `src/components`) |
| [docs/PART-C-GAME.md](docs/PART-C-GAME.md) | Part C: missions, rules, scoring, debrief (`src/game`) |
| [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) | The 30-second demo video, shot by shot |
| [docs/PROJECT-PAGE.md](docs/PROJECT-PAGE.md) | Draft text for every field of the submission form |

## Team

- [@AvnehSBhatia](https://github.com/AvnehSBhatia)
- [@github774](https://github.com/github774)
- [@sahilganapa-commits](https://github.com/sahilganapa-commits)

## Run it

Needs Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000/play. That page is a plain test harness that plays the whole game through the
contracts, and its "Run self-checks" button tests the brain and the game rules against the real data.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build, with type checking |
| `npm run lint` | Lint |
| `npm run data:fetch` | Refresh the archived NASA data in `src/data/` |

## NASA data

| Data | Source | Used for |
|---|---|---|
| Overnight low, daytime high, pressure, ultraviolet index, sunrise and sunset at Gale Crater, 4,745 sols | [Curiosity rover REMS feed](https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json), credit NASA/JPL-Caltech/CAB (CSIC-INTA) | Every sol of every mission: sunlight sets the solar energy, the overnight low sets the night's power need |
| Coronal mass ejections, geomagnetic storms, solar energetic particle events | [NASA DONKI](https://api.nasa.gov) | Saved for a future radiation mission; not used by the game yet |

`npm run data:fetch` saves a snapshot into `src/data/`. It is archived, real data, not live, and the app says
so in its footer. `npm run data:fetch -- --only=mars` refreshes just the Mars weather. DONKI allows at most 60
days per request and the shared `DEMO_KEY` only about 10 requests an hour; get a free key at
https://api.nasa.gov, copy `.env.example` to `.env.local` and put it there.

## Layout

```
src/contracts/index.ts        the shared contract (change only by agreement)
src/brain/                    Part A: forecasting tools, trust, test flights
src/game/                     Part C: missions, outpost rules (rules.ts), scoring, debrief
src/app/, src/components/     Part B: every screen
src/app/play/page.tsx         plain test harness for the whole loop
src/lib/nasa/                 typed access to the archived data
src/lib/rng.ts                seeded random numbers
src/data/                     archived NASA data (generated)
scripts/fetch-nasa-data.mjs   writes src/data/
docs/                         spec, part briefs, demo script, project page text
SUBMISSION.md                 submission rules and checklist
AI_USE.md                     log of AI tool use (required disclosure)
```

## Deploy

The "Link to Final Project" on the submission form must open without a login. Import this repository at
https://vercel.com/new (framework: Next.js, no settings to change). Test the deployed link in a private browser
window before submitting.

## Use of AI

Parts of this repository were generated with Claude Code, an AI coding tool: the scaffold, the reference
implementations and the first drafts of the documents. Every AI use is logged in [AI_USE.md](AI_USE.md), and
AI-written commits carry a `Co-Authored-By` trailer.

## Licence

[MIT](LICENSE). Built for the NASA Space Apps Challenge; not affiliated with or endorsed by NASA.
