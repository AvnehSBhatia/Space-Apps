# Space Apps

Our entry for the **2026 NASA Space Apps Challenge**, challenge
[Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/):
an interactive game or app that lets kids aged 7 to 12 run a lunar or Martian outpost and feel the real
trade-offs between life support, radiation shielding, power, food and communication delay.

The project itself is not chosen yet. This repository is the starter: a web app that runs in the browser with
no download or account, with real NASA data already loaded.

**Submission closes Sunday 15 November 2026 at 11:59 p.m. local time.** See [SUBMISSION.md](SUBMISSION.md).

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

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build, with type checking |
| `npm run lint` | Lint |
| `npm run data:fetch` | Refresh the archived NASA data in `src/data/` |

## NASA data

| Data | Source | Used for |
|---|---|---|
| Coronal mass ejections, geomagnetic storms, solar energetic particle events | [NASA DONKI](https://api.nasa.gov) | Real space weather and radiation risk |
| Daily temperature, pressure, sunrise and sunset at Gale Crater | [Curiosity rover REMS feed](https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json), credit NASA/JPL-Caltech/CAB (CSIC-INTA) | Real conditions on the Martian surface |

`npm run data:fetch` saves a snapshot of both into `src/data/`, and game code reads it through
`src/lib/nasa/snapshot.ts`. The snapshot is archived, real data. It is not live, and the app says so in its
footer. For live space weather there is a small server route, `/api/nasa/donki?type=GST&start=YYYY-MM-DD&end=YYYY-MM-DD`,
which keeps the API key off the client.

DONKI limits: at most 60 days per request (the helpers split longer ranges), and the shared `DEMO_KEY` allows
only about 10 requests an hour. Get a free key at https://api.nasa.gov, copy `.env.example` to `.env.local` and
put it there.

## Layout

```
src/app/page.tsx              home page (placeholder; the game goes here)
src/app/api/nasa/donki/       live DONKI proxy
src/components/data-credits   data attribution footer, keep it on every screen
src/lib/nasa/snapshot.ts      typed access to the archived data
src/lib/nasa/donki.ts         live DONKI client (server only)
src/lib/rng.ts                seeded random numbers for replayable missions
src/data/                     archived NASA data (generated)
scripts/fetch-nasa-data.mjs   writes src/data/
SUBMISSION.md                 submission rules, checklist and drafts
AI_USE.md                     log of AI tool use (required disclosure)
```

## Deploy

The "Link to Final Project" on the submission form must open without a login. Import this repository at
https://vercel.com/new (framework: Next.js, no settings to change) and add `NASA_API_KEY` as an environment
variable. Test the deployed link in a private browser window before submitting.

## Use of AI

The initial scaffold in this repository was generated with Claude Code, an AI coding tool. Every AI use is
logged in [AI_USE.md](AI_USE.md), and AI-written commits carry a `Co-Authored-By` trailer.

## Licence

[MIT](LICENSE). Built for the NASA Space Apps Challenge; not affiliated with or endorsed by NASA.
