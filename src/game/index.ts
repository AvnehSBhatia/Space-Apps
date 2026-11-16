// Part C: the game. Missions, the sol loop, the outpost rules, scoring and the debrief.
//
// Owner: Part C. This file is a working reference so Parts A and B are never blocked.
// Part C may rewrite anything in src/game as long as `game` keeps the GameApi contract.
// No React, no DOM, no network, no Math.random, no Date in here.

import type {
  Action,
  Bet,
  BrainDesign,
  CheckResult,
  Contact,
  Debrief,
  ForecastPair,
  GameApi,
  GameState,
  MissionId,
  MissionInfo,
  Mode,
  Outpost,
  RuleCard,
  Score,
  SolOutcome,
  SolReading,
  ToolId,
  UvIndex,
  WhatIf,
} from "../contracts";
import { brain } from "../brain";
import { allReadings } from "../lib/nasa/readings";
import { RULES, coveredDownToC, keepAliveWh } from "./rules";

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

type MissionPlan = MissionInfo & {
  /** The start sol is picked between these from the seed, so a mission cannot be memorised. */
  startMin: number;
  startMax: number;
  /** Sols with no contact with Earth, both ends included. */
  blackout: [number, number] | null;
};

const MISSIONS: MissionPlan[] = [
  {
    id: "calm2016",
    title: "A calm season",
    blurb: "The sky is clear and steady. Learn to run the outpost and keep a little energy in reserve.",
    realEvent: null,
    lengthSols: 12,
    difficulty: 1,
    ready: true,
    startMin: 1220,
    startMax: 1240,
    blackout: null,
  },
  {
    id: "conjunction2019",
    title: "Radio silence",
    blurb: "The Sun slides between Mars and Earth. For days, Mission Control cannot reach you.",
    realEvent:
      "Solar conjunction, August to September 2019: NASA stopped sending commands to its Mars missions for about two weeks.",
    lengthSols: 30,
    difficulty: 2,
    ready: true,
    startMin: 2494,
    startMax: 2500,
    blackout: [2509, 2519],
  },
  {
    id: "dust2018",
    title: "The great dust storm",
    blurb: "A dust storm is growing until it wraps the whole planet. Sunlight is about to get scarce.",
    realEvent:
      "The 2018 global dust storm. Curiosity measured sunlight at Gale Crater falling from Very High to Low and staying there for weeks. The solar-powered Opportunity rover never woke up.",
    lengthSols: 34,
    difficulty: 3,
    ready: true,
    startMin: 2056,
    startMax: 2064,
    blackout: null,
  },
];

const CORE_TOOLS: ToolId[] = ["copycat", "averager", "season", "trend"];
const LAB_TOOLS: ToolId[] = ["neurons", "spotlight", "longMemory"];
const MISSION_CONTROL: BrainDesign = { tools: CORE_TOOLS.map((id) => ({ uid: `earth-${id}`, id, knobs: {} })) };
/** Season Memory needs a Mars year of history, plus the training window. */
const HISTORY_FOR_BRAIN = 820;

const readings = () => allReadings();

function planOf(id: MissionId): MissionPlan {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}

function publicInfo(plan: MissionPlan): MissionInfo {
  return {
    id: plan.id,
    title: plan.title,
    blurb: plan.blurb,
    realEvent: plan.realEvent,
    lengthSols: plan.lengthSols,
    difficulty: plan.difficulty,
    ready: plan.ready,
  };
}

/** The sols a mission is played on: the first `lengthSols` sols from the hidden start that have a measured low. */
function missionSols(plan: MissionPlan, seed: number): SolReading[] {
  const span = plan.startMax - plan.startMin + 1;
  const start = plan.startMin + (Math.abs(Math.floor(seed)) % span);
  return readings()
    .filter((reading) => reading.sol >= start && reading.minTempC !== null)
    .slice(0, plan.lengthSols);
}

function sunlightOn(sol: number): UvIndex {
  const all = readings();
  for (let index = all.length - 1; index >= 0; index -= 1) {
    if (all[index].sol <= sol && all[index].uvIndex) return all[index].uvIndex as UvIndex;
  }
  return "Moderate";
}

/* ------------------------------------------------------------------ */
/* One sol                                                             */
/* ------------------------------------------------------------------ */

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function cleanBet(bet: Bet, maxGreenhouseWh: number): Bet {
  const wanted = Number.isFinite(bet.greenhouseWh) ? bet.greenhouseWh : 0;
  return { huddle: Boolean(bet.huddle), greenhouseWh: bet.huddle ? 0 : Math.round(clamp(wanted, 0, maxGreenhouseWh)) };
}

type Night = {
  batteryAtSunsetWh: number;
  keepAliveWh: number;
  hoursCold: number;
  batteryAfterWh: number;
  airMade: number;
  airAfter: number;
  cropLightAfterWh: number;
};

/** What one sol does to the battery, the air and the crop, for a given night low. */
function playNight(
  outpost: Outpost,
  solarWh: number,
  computerWh: number,
  bet: Bet,
  nightLowC: number,
  daylightHours: number | null,
): Night {
  const batteryAtSunsetWh = clamp(
    outpost.batteryWh + solarWh - computerWh - bet.greenhouseWh,
    0,
    RULES.BATTERY_CAPACITY_WH,
  );
  const needed = keepAliveWh(nightLowC, bet.huddle);
  const nightHours = RULES.SOL_HOURS - (daylightHours ?? RULES.SOL_HOURS / 2);
  const short = Math.max(0, needed - batteryAtSunsetWh);
  const hoursCold = needed > 0 ? Math.round((nightHours * short * 10) / needed) / 10 : 0;
  const airMade = Math.round(bet.greenhouseWh * RULES.AIR_PER_WH * 10) / 10;
  return {
    batteryAtSunsetWh,
    keepAliveWh: needed,
    hoursCold,
    batteryAfterWh: Math.max(0, batteryAtSunsetWh - needed),
    airMade,
    airAfter: clamp(outpost.airPercent - RULES.AIR_USE_PER_SOL + airMade, 0, 100),
    cropLightAfterWh: outpost.cropLightWh + bet.greenhouseWh,
  };
}

function resolve(state: GameState, today: SolReading): SolOutcome {
  const bet = cleanBet(state.bet, state.maxGreenhouseWh);
  const actualLowC = today.minTempC as number;
  const night = playNight(state.outpost, state.solarWh, state.computerWh, bet, actualLowC, today.daylightHours);
  const story: string[] = [];

  // Crop
  let cropLightWh = night.cropLightAfterWh;
  let cropStarvedSols = bet.greenhouseWh < RULES.CROP_MIN_WH ? state.outpost.cropStarvedSols + 1 : 0;
  let mealsHarvested = 0;
  let cropDied = false;
  if (cropStarvedSols >= 2 && state.outpost.cropLightWh > 0) {
    cropDied = true;
    cropLightWh = 0;
    cropStarvedSols = 0;
    story.push("The crop went two sols without enough light and died. A new one has to start from seed.");
  } else if (cropLightWh >= RULES.CROP_NEEDS_WH) {
    mealsHarvested = RULES.HARVEST_MEALS;
    cropLightWh = 0;
    story.push(`Harvest! The crew picked ${RULES.HARVEST_MEALS} meals.`);
  }

  // Food
  const mealsBefore = state.outpost.meals + mealsHarvested;
  const mealsEaten = Math.min(RULES.MEALS_PER_SOL, mealsBefore);
  const hungry = mealsEaten < RULES.MEALS_PER_SOL;

  // Health
  let healthChange = 0;
  if (night.hoursCold > 0) {
    healthChange -= Math.min(RULES.HEALTH_COLD_CAP, night.hoursCold * RULES.HEALTH_PER_COLD_HOUR);
    story.push(`The battery ran out ${night.hoursCold} hours before sunrise. The crew spent them in the cold.`);
  } else {
    story.push("The outpost stayed warm all night.");
  }
  if (night.airAfter < RULES.AIR_WARNING) {
    healthChange -= (RULES.AIR_WARNING - night.airAfter) * RULES.HEALTH_PER_AIR_POINT;
    story.push("The air is getting thin. The crew is tired and slow.");
  }
  if (hungry) {
    healthChange -= RULES.HEALTH_HUNGRY;
    story.push("The pantry is empty. The crew went to bed hungry.");
  }
  if (healthChange === 0) healthChange = RULES.HEALTH_RECOVER;
  healthChange = Math.round(healthChange);
  const crewHealth = clamp(state.outpost.crewHealth + healthChange, 0, RULES.START_HEALTH);
  if (bet.huddle) story.push("The crew huddled in one room, so the greenhouse stayed dark today.");

  return {
    sol: today.sol,
    earthDate: today.earthDate,
    bet,
    sunlight: state.sunlight,
    actualLowC,
    solarWh: state.solarWh,
    computerWh: state.computerWh,
    batteryAtSunsetWh: night.batteryAtSunsetWh,
    keepAliveWh: night.keepAliveWh,
    hoursCold: night.hoursCold,
    airMade: night.airMade,
    airUsed: RULES.AIR_USE_PER_SOL,
    mealsEaten,
    mealsHarvested,
    cropDied,
    healthChange,
    outpostAfter: {
      crewHealth,
      batteryWh: night.batteryAfterWh,
      airPercent: night.airAfter,
      meals: mealsBefore - mealsEaten,
      cropLightWh,
      cropNeedsWh: RULES.CROP_NEEDS_WH,
      cropStarvedSols,
    },
    story,
  };
}

/* ------------------------------------------------------------------ */
/* Forecasts and the morning                                           */
/* ------------------------------------------------------------------ */

function forecastWith(design: BrainDesign, history: SolReading[], morning: SolReading | null, seed: number): ForecastPair {
  const recentHistory = history.slice(-HISTORY_FOR_BRAIN);
  const withMorning = morning ? [...recentHistory, morning] : recentHistory;
  return {
    nightLow: brain.predict(brain.train(design, recentHistory, "nightLowC", seed), recentHistory),
    sunlightTomorrow: brain.predict(brain.train(design, withMorning, "sunlight", seed), withMorning),
  };
}

function scoreOf(outpost: Outpost, outcomes: SolOutcome[]): Score {
  const mealsHarvested = outcomes.reduce((sum, outcome) => sum + outcome.mealsHarvested, 0);
  const lastNight = outcomes.length > 0 ? outcomes[outcomes.length - 1].keepAliveWh : keepAliveWh(-75, false);
  const spareNights = Math.floor(outpost.batteryWh / Math.max(1, lastNight));
  return {
    total: Math.round(outpost.crewHealth * 5 + mealsHarvested * 2 + Math.min(3, spareNights) * 20),
    crewHealth: Math.round(outpost.crewHealth),
    mealsHarvested,
    spareNights,
  };
}

/** Fills in everything the player sees in the morning of state.solIndex. */
function morning(state: GameState): GameState {
  const plan = planOf(state.mission.id);
  const today = missionSols(plan, state.seed)[state.solIndex];
  const history = readings().filter((reading) => reading.sol < today.sol);
  const sunlight = today.uvIndex ?? sunlightOn(today.sol - 1);
  const contact: Contact =
    plan.blackout && today.sol >= plan.blackout[0] && today.sol <= plan.blackout[1] ? "blackout" : "normal";
  const computerWh = brain.energy(state.design);
  const solarWh = RULES.SOLAR_WH[sunlight];
  const maxGreenhouseWh = Math.round(
    clamp(state.outpost.batteryWh + solarWh - computerWh, 0, RULES.GREENHOUSE_MAX_WH),
  );
  // The morning row holds only what is known in the morning: today's sunlight. Never tonight's low.
  const morningRow: SolReading = {
    sol: today.sol,
    earthDate: today.earthDate,
    minTempC: null,
    maxTempC: null,
    pressurePa: null,
    uvIndex: sunlight,
    daylightHours: today.daylightHours,
    solarLongitude: today.solarLongitude,
  };

  return {
    ...state,
    phase: "report",
    todaySol: today.sol,
    todayEarthDate: today.earthDate,
    sunlight,
    history,
    contact,
    solarWh,
    computerWh,
    maxGreenhouseWh,
    // Mission Control works from data that is one sol old, and is silent during a blackout.
    earthForecast: contact === "normal" ? forecastWith(MISSION_CONTROL, history.slice(0, -1), null, state.seed) : null,
    outpostForecast: state.design.tools.length > 0 ? forecastWith(state.design, history, morningRow, state.seed) : null,
    bet: cleanBet(state.bet, maxGreenhouseWh),
    problem: null,
  };
}

function refuse(state: GameState, problem: string): GameState {
  return { ...state, problem };
}

/* ------------------------------------------------------------------ */
/* The reducer                                                         */
/* ------------------------------------------------------------------ */

function start(missionId: MissionId, seed: number, mode: Mode): GameState {
  const plan = planOf(missionId);
  const outpost: Outpost = {
    crewHealth: RULES.START_HEALTH,
    batteryWh: RULES.START_BATTERY_WH,
    airPercent: RULES.START_AIR,
    meals: RULES.START_MEALS,
    cropLightWh: 0,
    cropNeedsWh: RULES.CROP_NEEDS_WH,
    cropStarvedSols: 0,
  };
  const blank: GameState = {
    version: 1,
    mission: publicInfo(plan),
    seed: Math.abs(Math.floor(seed)),
    mode,
    phase: "report",
    solIndex: 0,
    todaySol: 0,
    todayEarthDate: null,
    sunlight: "Moderate",
    history: [],
    contact: "normal",
    outpost,
    solarWh: 0,
    computerWh: 0,
    maxGreenhouseWh: 0,
    design: { tools: [] },
    earthForecast: null,
    outpostForecast: null,
    bet: { greenhouseWh: 6_000, huddle: false },
    availableTools: mode === "guided" ? [] : mode === "builder" ? CORE_TOOLS : [...CORE_TOOLS, ...LAB_TOOLS],
    outcomes: [],
    score: scoreOf(outpost, []),
    ending: null,
    problem: null,
  };
  return morning(blank);
}

function lock(state: GameState): GameState {
  const today = missionSols(planOf(state.mission.id), state.seed)[state.solIndex];
  const outcome = resolve(state, today);
  const outcomes = [...state.outcomes, outcome];
  const outpost = outcome.outpostAfter;
  const lastSol = state.solIndex >= state.mission.lengthSols - 1;
  const ending = outpost.crewHealth <= 0 ? "crewLost" : lastSol ? "survived" : null;
  return {
    ...state,
    phase: "night",
    bet: outcome.bet,
    outpost,
    outcomes,
    score: scoreOf(outpost, outcomes),
    ending,
    problem: null,
  };
}

function next(state: GameState): GameState {
  if (state.ending) return { ...state, phase: "ended", problem: null };
  return morning({ ...state, solIndex: state.solIndex + 1 });
}

/** True when the morning needs the player's attention, so fast-forward should stop. */
function needsAttention(state: GameState, before: GameState): boolean {
  const { outpost } = state;
  return (
    state.sunlight !== before.sunlight ||
    state.contact !== before.contact ||
    outpost.airPercent < RULES.AIR_WARNING + 10 ||
    outpost.crewHealth < 60 ||
    outpost.meals < RULES.MEALS_PER_SOL * 2
  );
}

function fastForward(state: GameState): GameState {
  let current = state;
  for (let step = 0; step < 12; step += 1) {
    const before = current;
    current = next(current);
    if (current.phase === "ended" || needsAttention(current, before)) return current;
    current = lock({ ...current, phase: "bet", bet: cleanBet(before.bet, current.maxGreenhouseWh) });
    const outcome = current.outcomes[current.outcomes.length - 1];
    if (current.ending || outcome.hoursCold > 0 || outcome.cropDied || outcome.mealsHarvested > 0) return current;
  }
  return current;
}

function reduce(state: GameState, action: Action): GameState {
  try {
    switch (action.type) {
      case "setDesign": {
        if (state.phase !== "report" && state.phase !== "bet") return refuse(state, "Tools can only be changed before the bet is locked.");
        const ready = new Set(brain.catalog().filter((tool) => tool.ready).map((tool) => tool.id));
        const allowed = action.design.tools.every((tool) => state.availableTools.includes(tool.id) && ready.has(tool.id));
        if (!allowed) return refuse(state, "That tool is not available on this mission.");
        return { ...morning({ ...state, design: action.design }), phase: state.phase };
      }
      case "goToBet":
        return state.phase === "report" ? { ...state, phase: "bet", problem: null } : refuse(state, "Read the morning report first.");
      case "setBet":
        return state.phase === "bet"
          ? { ...state, bet: cleanBet(action.bet, state.maxGreenhouseWh), problem: null }
          : refuse(state, "The bet can only be changed before it is locked.");
      case "lockBet":
        return state.phase === "bet" ? lock(state) : refuse(state, "There is no bet to lock right now.");
      case "nextSol":
        return state.phase === "night" ? next(state) : refuse(state, "Lock in the bet to see the night first.");
      case "fastForward":
        return state.phase === "night" ? fastForward(state) : refuse(state, "Fast-forward starts after a night.");
      default:
        return refuse(state, "Unknown action.");
    }
  } catch (error) {
    return refuse(state, error instanceof Error ? error.message : "Something went wrong.");
  }
}

function whatIf(state: GameState, bet: Bet, nightLowC: number): WhatIf {
  const today = missionSols(planOf(state.mission.id), state.seed)[state.solIndex];
  const clean = cleanBet(bet, state.maxGreenhouseWh);
  const night = playNight(state.outpost, state.solarWh, state.computerWh, clean, nightLowC, today.daylightHours);
  return {
    batteryAtSunsetWh: night.batteryAtSunsetWh,
    keepAliveWh: night.keepAliveWh,
    hoursCold: night.hoursCold,
    airAfter: night.airAfter,
    cropLightAfterWh: night.cropLightAfterWh,
    coveredDownToC: coveredDownToC(night.batteryAtSunsetWh, clean.huddle),
    spareNights: Math.floor(night.batteryAtSunsetWh / Math.max(1, night.keepAliveWh)),
  };
}

/* ------------------------------------------------------------------ */
/* The careful commander, the debrief and the rules page               */
/* ------------------------------------------------------------------ */

/** A simple rule that cannot see the future: keep two nights in the battery, huddle when the sky goes dark. */
export function carefulBet(state: GameState): Bet {
  const lastLow = [...state.history].reverse().find((reading) => reading.minTempC !== null)?.minTempC ?? -75;
  const oneNight = keepAliveWh(lastLow, false);
  const available = state.outpost.batteryWh + state.solarWh - state.computerWh;
  if (state.sunlight === "Low") {
    if (state.outpost.airPercent > 45) return { huddle: true, greenhouseWh: 0 };
    return { huddle: false, greenhouseWh: clamp(available - oneNight, 0, state.maxGreenhouseWh) };
  }
  const airBreakEven = RULES.AIR_USE_PER_SOL / RULES.AIR_PER_WH;
  const wanted = Math.max(available - 2 * oneNight, Math.min(airBreakEven, available - oneNight));
  return { huddle: false, greenhouseWh: clamp(wanted, 0, state.maxGreenhouseWh) };
}

/** Plays a whole mission with one rule. Used by the debrief and by the balance checks. */
export function playWith(missionId: MissionId, seed: number, choose: (state: GameState) => Bet): GameState {
  let state = start(missionId, seed, "guided");
  for (let guard = 0; guard < 200 && state.phase !== "ended"; guard += 1) {
    state = reduce(state, { type: "goToBet" });
    state = reduce(state, { type: "setBet", bet: choose(state) });
    state = reduce(state, { type: "lockBet" });
    state = reduce(state, { type: "nextSol" });
  }
  return state;
}

function debrief(state: GameState): Debrief {
  const { outcomes } = state;
  const lines: string[] = [];
  const coldNights = outcomes.filter((outcome) => outcome.hoursCold > 0).length;
  const stormIndex = outcomes.findIndex((outcome) => outcome.sunlight === "Low");

  if (stormIndex > 0) {
    const before = outcomes[stormIndex - 1];
    const spare = Math.floor(before.outpostAfter.batteryWh / Math.max(1, before.keepAliveWh));
    lines.push(
      spare > 0
        ? `When the sky went dark you had ${spare} spare ${spare === 1 ? "night" : "nights"} of battery.`
        : "When the sky went dark your battery could not cover even one more night.",
    );
  }
  lines.push(
    coldNights === 0
      ? "The crew never spent a night in the cold."
      : `The crew spent ${coldNights} ${coldNights === 1 ? "night" : "nights"} in the cold.`,
  );
  lines.push(`You harvested ${state.score.mealsHarvested} meals.`);
  if (state.mission.id === "dust2018") {
    lines.push(
      "In this same storm the solar-powered Opportunity rover lost almost all of its power and never woke up. Curiosity runs on a nuclear power source, so it kept working and recorded the data you just played.",
    );
  }

  return {
    headline: state.ending === "crewLost" ? "The crew had to be evacuated." : "All four crew made it through.",
    lines,
    carefulCommander: playWith(state.mission.id, state.seed, carefulBet).score,
  };
}

function rules(): RuleCard[] {
  const kWh = (wh: number) => `${wh / 1000} kWh`;
  return [
    {
      id: "sunlight",
      title: "Sunlight",
      plain: "How much sunlight reached the ground that sol, measured by the Curiosity rover.",
      formula: "The rover's ultraviolet index: Low, Moderate, High or Very High.",
      kind: "NASA measurement",
      source: "Curiosity REMS weather station, Gale Crater. NASA/JPL-Caltech/CAB (CSIC-INTA).",
    },
    {
      id: "solar",
      title: "Solar energy",
      plain: "Brighter sunlight means the panels collect more energy.",
      formula: `Very High ${kWh(RULES.SOLAR_WH.Very_High)}, High ${kWh(RULES.SOLAR_WH.High)}, Moderate ${kWh(RULES.SOLAR_WH.Moderate)}, Low ${kWh(RULES.SOLAR_WH.Low)} a sol.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "nightLow",
      title: "Overnight low",
      plain: "The coldest the air got that night, measured by the Curiosity rover.",
      formula: "Degrees Celsius.",
      kind: "NASA measurement",
      source: "Curiosity REMS weather station, Gale Crater. NASA/JPL-Caltech/CAB (CSIC-INTA).",
    },
    {
      id: "keepAlive",
      title: "Night power",
      plain: "Every night the outpost must run heaters, fans and air scrubbers. Colder nights cost a little more.",
      formula: `${kWh(RULES.KEEP_ALIVE_BASE_WH)} + ${RULES.HEAT_WH_PER_DEGREE} Wh for each degree the outside is colder than ${RULES.INSIDE_C} C.`,
      kind: "game rule",
      source: "Heat leaks faster the bigger the temperature difference (physics); the size of the habitat is a game rule.",
    },
    {
      id: "huddle",
      title: "Huddle",
      plain: "The crew moves into one room. Night power drops, but the greenhouse is switched off for the sol.",
      formula: `Night power x ${RULES.HUDDLE_FACTOR}; greenhouse light 0.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "air",
      title: "Air",
      plain: "The crew uses air every sol. The air recycler and the plants make more when the greenhouse has power.",
      formula: `Uses ${RULES.AIR_USE_PER_SOL} points a sol; makes ${RULES.AIR_PER_WH * 1000} points for each kWh of greenhouse light.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "crop",
      title: "Crop",
      plain: "A crop needs many sols of light before it can be picked. Two sols without enough light kill it.",
      formula: `Harvest at ${kWh(RULES.CROP_NEEDS_WH)} of light for ${RULES.HARVEST_MEALS} meals; starved below ${kWh(RULES.CROP_MIN_WH)} a sol.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "mars-day",
      title: "A sol",
      plain: "A day on Mars is called a sol. It is a little longer than a day on Earth.",
      formula: `${RULES.SOL_HOURS} hours.`,
      kind: "physics",
      source: null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Self-checks                                                         */
/* ------------------------------------------------------------------ */

function selfCheck(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, run: () => string | true) => {
    try {
      const outcome = run();
      results.push({ name, pass: outcome === true, detail: outcome === true ? "ok" : outcome });
    } catch (error) {
      results.push({ name, pass: false, detail: error instanceof Error ? error.message : "threw" });
    }
  };
  const greedy = (state: GameState): Bet => ({ huddle: false, greenhouseWh: state.maxGreenhouseWh });

  check("every mission has enough real sols", () => {
    for (const plan of MISSIONS) {
      for (let seed = 0; seed < plan.startMax - plan.startMin + 1; seed += 1) {
        const sols = missionSols(plan, seed);
        if (sols.length < plan.lengthSols) return `${plan.id} seed ${seed}: ${sols.length} sols`;
      }
    }
    return true;
  });

  check("tonight's low is hidden until the bet is locked", () => {
    const state = reduce(start("dust2018", 3, "builder"), { type: "goToBet" });
    return state.history.every((reading) => reading.sol < state.todaySol) ? true : "history contains today";
  });

  check("same mission and seed give the same game", () => {
    const first = JSON.stringify(playWith("calm2016", 5, carefulBet).score);
    const second = JSON.stringify(playWith("calm2016", 5, carefulBet).score);
    return first === second ? true : "two runs differ";
  });

  check("a refused action sets a problem and changes nothing else", () => {
    const state = start("calm2016", 1, "guided");
    const refused = reduce(state, { type: "lockBet" });
    return refused.problem && refused.phase === state.phase ? true : "lockBet was accepted in the report phase";
  });

  check("a state survives a save and load", () => {
    const state = reduce(start("calm2016", 1, "builder"), { type: "goToBet" });
    const loaded = JSON.parse(JSON.stringify(state)) as GameState;
    return reduce(loaded, { type: "lockBet" }).outcomes.length === 1 ? true : "loaded state did not play";
  });

  check("the careful commander survives every mission", () => {
    for (const plan of MISSIONS) {
      const end = playWith(plan.id, 2, carefulBet);
      if (end.ending !== "survived") return `${plan.id}: ${end.ending} on sol ${end.solIndex + 1}`;
    }
    return true;
  });

  check("spending everything loses the dust storm", () => {
    const end = playWith("dust2018", 2, greedy);
    return end.ending === "crewLost" ? true : `greedy play ended ${end.ending} with health ${end.outpost.crewHealth}`;
  });

  check("fast-forward ends in a state the player can act on", () => {
    let state = start("conjunction2019", 1, "guided");
    state = reduce(state, { type: "goToBet" });
    state = reduce(state, { type: "lockBet" });
    state = reduce(state, { type: "fastForward" });
    return ["report", "night", "ended"].includes(state.phase) && state.problem === null
      ? true
      : `phase ${state.phase}, problem ${state.problem}`;
  });

  return results;
}

export const game: GameApi = {
  missions: () => MISSIONS.map(publicInfo),
  start,
  reduce,
  whatIf,
  debrief,
  rules,
  selfCheck,
};
