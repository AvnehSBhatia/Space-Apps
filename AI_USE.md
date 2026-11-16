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
| 2026-11-15 | Claude Code (Anthropic) | Drafts of the spec, the three part briefs, the demo script and the project page text | `docs/` |
| 2026-11-15 | Claude Code (Anthropic) with Sonnet, Opus and Fable subagents | The Part A brain (tool files, trust, range, engine checks) and the rewritten `docs/PART-A-BRAIN.md` | `src/brain`, on the `brain` branch |

## How we mark it

- **Code:** commits that contain AI-written code carry a `Co-Authored-By` trailer naming the tool.
- **Images and video:** a visible "AI-generated" watermark on the asset itself.
- **Audio:** stated in the description next to it and in the file's metadata.
