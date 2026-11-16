# Use of AI tools

NASA Space Apps permits AI tools but requires us to say where and how we used them. AI-made images and video
need a visible watermark; AI-made audio, code and data must be acknowledged in descriptive text and metadata.
Generated content may not contain NASA logos, flags or mission identifiers.

Add a row every time an AI tool produces something that ends up in the project. This file is the source for the
"Use of Super Intelligence (SI)" field on the project form.

| Date | Tool | What it produced | Where it is |
|---|---|---|---|
| 2026-11-15 | Claude Code (Anthropic) | Initial project scaffold: NASA data fetch script, data helpers, placeholder page, CI, README and submission checklist | Initial commit; see the `Co-Authored-By` trailer in the commit message |
| 2026-11-15 | Claude Code (Anthropic) | Shared contracts, reference implementations of the brain (`src/brain`) and the game rules (`src/game`), and the `/play` test harness | Second commit; `Co-Authored-By` trailer |
| 2026-11-15 | Claude Code (Anthropic) | Twelve simulated judge reviews of the concept against the official rubric; their feedback changed the design | Summarised in `docs/SPEC.md` |
| 2026-11-15 | Claude Code (Anthropic) | Part C: balance tuning, crew story lines, debrief, guided hints, rule cards with NASA sources, localStorage leaderboard, balance bench and self-checks | `src/game/`; `Co-Authored-By` trailer |
| 2026-11-15 | Claude Code (Anthropic) | Drafts of the spec, the three part briefs, the demo script and the project page text | `docs/` |
| 2026-11-15 | Claude Code (Anthropic) with Sonnet, Opus and Fable subagents | The Part A brain (tool files, trust, range, engine checks) and the rewritten `docs/PART-A-BRAIN.md` | `src/brain`, on the `brain` branch |
| 2026-11-15 | Claude Code (Anthropic) | The game UI (Part B): screens, components, styles and icons | `src/app`, `src/components`; `Co-Authored-By` trailer |
| 2026-11-15 | OpenAI image generation via Codex CLI, directed by Claude Code | Design mockups used only as layout references. No AI image ships in the game: every illustration is hand-built SVG in `src/components/mars-scene.tsx` | Not in the repo |
| 2026-11-15 | Claude Code (Anthropic) subagents, following the UltraUI skill library | The one-screen-per-sol Today panel with the coloured slider and Ask Mission Control; the 3D outpost scene on the game screen; the 3D Mars globe on the home page. All drawn in code: no AI-generated image, video or audio files | `src/components/panels.tsx`, `mission-app.tsx`, `outpost-3d.tsx`, `game-stage.tsx`, `mars-globe-3d.tsx`, `home-hero.tsx` |

## How we mark it

- **Code:** commits that contain AI-written code carry a `Co-Authored-By` trailer naming the tool.
- **Images and video:** a visible "AI-generated" watermark on the asset itself.
- **Audio:** stated in the description next to it and in the file's metadata.
