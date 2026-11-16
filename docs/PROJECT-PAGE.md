# Project page text

Drafts for each field of the Space Apps project form. Edit them to match what we actually ship, then paste.
Everything in [square brackets] must be replaced or checked before submitting. All fields must be in English.

## Project Name

SolCast

## High-Level Project Summary

SolCast is a browser game in which kids aged 7 to 12 keep a four-person Mars outpost alive through real
stretches of the Curiosity rover's weather record. Each Mars day the player sees the rover's real sunlight
reading, decides how much solar energy to spend growing air and food and how much to keep in the battery for
the night, and then the real measured overnight low decides what happens to the crew. One mission replays the
2018 global dust storm, when measured sunlight at Gale Crater fell from Very High to Low within about eight
sols. Because the outcome comes from NASA data and not from invented numbers, players feel a real constraint
of living on Mars: air, food and warmth all come out of one battery, and no forecast sees a storm coming.

## Link to Project Demo

[link to the 30-second video or the 7-slide deck; test it in a private window]

## Link to Final Project

https://solcast-mars.vercel.app

Code: https://github.com/AvnehSBhatia/Space-Apps

## Detailed Project Description

**What it does.** The player runs a small Mars outpost for 12 to 34 Mars days (sols). There are three gauges,
Battery, Air and Food, and four crew members who visibly react to how the outpost is doing. Each sol has one
decision: a slider for how much of the day's solar energy runs the greenhouse lights. Air returns the next
sol; food is a slow crop that needs about ten sols of light and dies if it is starved. Whatever is not spent
stays in a small battery that must power the outpost through the night. One emergency button, Huddle, moves
the crew into one room: night power drops by more than half, but the greenhouse is off for the sol.

**How it works.** Every sol in the game is a real sol from the Curiosity rover's REMS weather station. The
rover's measured ultraviolet index sets how much energy the solar panels collect, and its measured overnight
low sets how much power the night needs. The player commits to a plan, and only then is the real overnight low
revealed. Mission Control sends a forecast each sol that is one sol old; during the 2019 solar conjunction
mission it goes silent for eleven sols, the real dates NASA held off commanding its Mars missions. Older players can install simple forecasting tools on
the outpost computer (same as yesterday, an average, the same day last Mars year, a trend line) and test each
one on days it has not seen before trusting it. Measured on the real record, "same as today" predicts
tomorrow's sunlight on 92% of sols and no tool beats it in calm weather, yet every tool fails on the day the
storm arrives. The game says so, and the lesson is to keep a reserve.

**Missions.** A calm season (the tutorial); Radio silence (solar conjunction, 2019); The great dust storm
(2018). Each starts on a hidden sol chosen from a seed, so a mission can be replayed or shared with a class
by its code, but not memorised.

**Honest about what is real.** Any number on screen can be tapped to show whether it is a NASA measurement,
physics or a game rule, with its source. A "How it works" page lists every formula. The data is archived, not
live, and the game says so on every screen.

**Benefits.** It runs in a browser with no download and no account. Players use call signs, never names. Every
mission has a code, so a class can play the very same sols and compare outcomes.

**What we hope to achieve.** A child who finishes the dust storm mission should be able to say why a Mars base
needs spare energy, and why NASA is developing nuclear power for crewed bases.

**Tools.** TypeScript, Next.js, React, Tailwind CSS, and three.js with React Three Fiber for the 3D outpost and
the Mars globe, which are drawn entirely in code. The forecasting tools and game rules are plain TypeScript
with no machine-learning library. Hosted on Vercel.

## Use of Super Intelligence (SI)

[Check every sentence here is true for what we actually did, and add anything missing.]

Yes. We used Claude (Anthropic), through Claude Code, to:

- scaffold the repository and write the script that downloads the NASA data;
- write first versions of the forecasting, game-rule and test-harness code, which we then changed and extended;
- review our concept against the judging rubric with simulated judges, whose feedback changed the design
  (for example, making the outpost decision the core loop instead of the forecasting tools);
- draft the specification, this page and the demo script, which we edited.

[List any tools used for UI design, images, audio or video, and what each produced.]

Commits that contain AI-written code carry a `Co-Authored-By` trailer, and every use is logged in `AI_USE.md`
in the repository. [AI-generated images and video carry a visible watermark.] No generated content uses NASA
logos, flags or mission identifiers.

## NASA Data

- **Curiosity rover REMS weather record (Mars Science Laboratory).** Daily overnight low, daytime high,
  pressure, ultraviolet index, sunrise and sunset at Gale Crater for 4,745 sols, 2012 to 2026, from NASA's Mars
  weather feed: https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json
  Credit: NASA/JPL-Caltech/CAB (CSIC-INTA). The ultraviolet index sets each sol's solar energy; the overnight
  low sets the night's power need and is the measurement revealed after the player commits. This data is the
  game: without it there are no missions.
- [Only if the shipped game uses it] **NASA DONKI** (Space Weather Database Of Notifications, Knowledge,
  Information): https://api.nasa.gov

## Space Agency Partner Data and Other References

- REMS was built by Spain's Centro de Astrobiología (CAB, CSIC-INTA).
- Next.js, React, Tailwind CSS, TypeScript, three.js, React Three Fiber and drei (all open source).
- Fonts: Sora, Figtree and Martian Mono, SIL Open Font License, via Google Fonts.
- [Every image, sound, icon set and library we used, with its licence.]
- [Any code reused from our own earlier projects.]
