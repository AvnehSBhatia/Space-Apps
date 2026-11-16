# Sources for the facts the game states

Checked on 15 November 2026 by opening each page. Use these links in the rule cards (`game.rules()`), the
debrief and the project page. If a sentence in the game is not backed by a line here or by our own data,
cut it.

## From our own data (`src/data/mars-weather-curiosity.json`, the Curiosity REMS feed)

| Fact | How to reproduce |
|---|---|
| 4,745 sols of weather, sol 1 (7 August 2012) to sol 4995 (25 August 2026) | `npm run data:fetch -- --only=mars` prints the count |
| In the 2018 storm the sunlight index fell from Very High to Low between sols 2075 and 2082 and stayed Low past sol 2121 | The `uvIndex` field for those sols |
| "Same as today" predicts tomorrow's sunlight level on 92% of sols | `npm run check`, the Copycat table |
| How far each forecasting tool misses on each mission | `npm run check` |

## From NASA pages

**The 2018 global dust storm and Opportunity**

- Dust opacity ("tau") at Opportunity's site reached an estimated 10.8 on 10 June 2018; a normal value there
  is about 0.5. The rover needed tau below 2.0 to recharge.
- Opportunity's power dropped sharply by 6 June 2018, it went to minimal operations, and engineers then
  stopped hearing from it. NASA assumed it had entered a low-power fault mode.
- Sources: JPL, "Opportunity Hunkers Down During Dust Storm",
  https://www.jpl.nasa.gov/news/opportunity-hunkers-down-during-dust-storm/ and JPL, "Six Things About
  Opportunity's Recovery Efforts", https://www.jpl.nasa.gov/news/six-things-about-opportunitys-recovery-efforts/

**Not confirmed, do not quote:** the figure that Opportunity's solar energy fell from about 645 to 22
watt-hours a sol. The NASA status page that carried it has moved and we could not open it. Say "lost almost
all of its power" and give the opacity numbers above instead.

**Solar conjunction, 2019**

- Mars and Earth were on opposite sides of the Sun, and NASA held off sending commands to its Mars spacecraft
  from 28 August to 7 September 2019 (the "command moratorium"). Conjunction happens about every two years.
- Source: JPL, "What's Mars Solar Conjunction, and Why Does It Matter?", 23 August 2019,
  https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/
- In the game this is rover sols 2509 to 2519, eleven sols. The mission text in `src/game/index.ts` says
  "about two weeks"; Part C should change it to "eleven days".

## Still to source before quoting

- That Curiosity is nuclear-powered (a radioisotope power system) and kept working through the storm.
- That NASA is developing fission power for crewed surface bases.

Both are well known, but find the NASA page and add the link here before the game or the project page says so.
