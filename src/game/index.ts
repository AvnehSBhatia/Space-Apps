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
import { makeCallSign, missionCode, parseMissionCode } from "./leaderboard";
import { RULES, coveredDownToC, keepAliveWh } from "./rules";

/* ------------------------------------------------------------------ */
/* Crew                                                                */
/* ------------------------------------------------------------------ */

/**
 * The four crew. Original characters; the story lines use these names. Part B draws them.
 * Exported for the UI (not part of the contract, so it can grow without a contract change).
 */
export const CREW = [
  { id: "ravi", name: "Ravi", job: "Commander" },
  { id: "mina", name: "Mina", job: "Botanist" },
  { id: "theo", name: "Theo", job: "Engineer" },
  { id: "zara", name: "Zara", job: "Doctor" },
] as const;

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
      "Solar conjunction, 28 August to 7 September 2019: the Sun sat between Earth and Mars, so NASA stopped sending commands to its Mars missions.",
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
    // Sunlight goes Low on sol 2082 and stays Low. This window keeps 8 to 12 Low sols in the mission:
    // a later start leaves so many dark sols that no plan can keep air, food and heat going at once.
    startMin: 2056,
    startMax: 2060,
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

/** Hints for a first-time player, one per sol, on the first sols of the calm mission in guided mode. */
const GUIDED_HINTS = [
  "Tip: try keeping two nights of power in the battery.",
  "Tip: the greenhouse makes air. Give it some power every sol.",
  "Tip: plants need about eight sols of light to grow.",
];

function resolve(state: GameState, today: SolReading): SolOutcome {
  const bet = cleanBet(state.bet, state.maxGreenhouseWh);
  const actualLowC = today.minTempC as number;
  const night = playNight(state.outpost, state.solarWh, state.computerWh, bet, actualLowC, today.daylightHours);
  const story: string[] = [];
  // A different crew member takes the lead each sol, so all four get named.
  const name = (offset: number) => CREW[(state.solIndex + offset) % CREW.length].name;
  const yesterday = state.outcomes[state.outcomes.length - 1];

  if (state.sunlight === "Low" && yesterday && yesterday.sunlight !== "Low") {
    story.push("Dust is hiding the Sun. The panels got much less power.");
  }

  // Crop
  let cropLightWh = night.cropLightAfterWh;
  let cropStarvedSols = bet.greenhouseWh < RULES.CROP_MIN_WH ? state.outpost.cropStarvedSols + 1 : 0;
  let mealsHarvested = 0;
  let cropDied = false;
  if (cropStarvedSols >= 2 && state.outpost.cropLightWh > 0) {
    cropDied = true;
    cropLightWh = 0;
    cropStarvedSols = 0;
    story.push("Two dark sols in a row. The plants died.");
    story.push(`${name(1)} planted new seeds. They need ${RULES.CROP_MIN_WH / 1000} kWh of light a sol.`);
  } else if (cropLightWh >= RULES.CROP_NEEDS_WH) {
    mealsHarvested = RULES.HARVEST_MEALS;
    cropLightWh = 0;
    story.push(`Harvest! ${name(1)} picked ${RULES.HARVEST_MEALS} meals of fresh food.`);
  }

  // Food
  const mealsBefore = state.outpost.meals + mealsHarvested;
  const mealsEaten = Math.min(RULES.MEALS_PER_SOL, mealsBefore);
  const hungry = mealsEaten < RULES.MEALS_PER_SOL;

  // Health
  let healthChange = 0;
  if (night.hoursCold > 0) {
    healthChange -= Math.min(RULES.HEALTH_COLD_CAP, night.hoursCold * RULES.HEALTH_PER_COLD_HOUR);
    story.push(`The battery ran out ${night.hoursCold} hours before sunrise.`);
    story.push(`${name(0)}'s hands are cold. Save more power for the night.`);
  } else if (bet.huddle) {
    story.push("Everyone huddled in one room to save power.");
    story.push(`${name(0)} and ${name(2)} told stories until sunrise. Nobody got cold.`);
  } else {
    story.push(`The heaters ran all night. ${name(0)} slept warm.`);
  }
  if (night.airAfter < RULES.AIR_WARNING) {
    healthChange -= (RULES.AIR_WARNING - night.airAfter) * RULES.HEALTH_PER_AIR_POINT;
    story.push(`The air is thin. ${name(3)} feels tired and slow.`);
    story.push("Power the greenhouse to make more air.");
  }
  if (hungry) {
    healthChange -= RULES.HEALTH_HUNGRY;
    story.push("The pantry is empty. The crew went to bed hungry.");
  }
  if (healthChange === 0) healthChange = RULES.HEALTH_RECOVER;
  healthChange = Math.round(healthChange);
  const crewHealth = clamp(state.outpost.crewHealth + healthChange, 0, RULES.START_HEALTH);
  if (bet.huddle) story.push("The greenhouse stayed dark today.");
  if (state.mode === "guided" && state.mission.id === "calm2016" && state.solIndex < GUIDED_HINTS.length) {
    story.push(GUIDED_HINTS[state.solIndex]);
  }

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
  // Plan for a night a little colder than the last one: no forecast is exact.
  const oneNight = keepAliveWh(lastLow - RULES.CAREFUL_MARGIN_C, false);
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

/** One sentence naming the trade the player made, from how they spent their energy. */
function tradeLine(state: GameState): string {
  const { outcomes } = state;
  if (outcomes.length === 0) return "Every sol is a trade between air, food and a warm night.";
  const coldNights = outcomes.filter((outcome) => outcome.hoursCold > 0).length;
  const huddles = outcomes.filter((outcome) => outcome.bet.huddle).length;
  const lowAir = outcomes.some((outcome) => outcome.outpostAfter.airPercent < RULES.AIR_WARNING);
  const starved = outcomes.some((outcome) => outcome.cropDied);
  if (coldNights > 0 && !lowAir) return "You spent on air and food, and paid for it with cold nights.";
  if (lowAir || (starved && huddles === 0)) return "You saved power for the nights, and the air and plants paid for it.";
  if (huddles > 0) return `You kept a reserve and huddled ${huddles} ${huddles === 1 ? "time" : "times"} when it counted.`;
  return "You kept a reserve and spent the rest on air and food.";
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
  lines.push(
    state.score.mealsHarvested > 0
      ? `You grew ${state.score.mealsHarvested} meals of fresh food.`
      : "The greenhouse never grew a harvest.",
  );
  if (outcomes.length > 0) {
    const lowestAir = Math.round(Math.min(...outcomes.map((outcome) => outcome.outpostAfter.airPercent)));
    lines.push(`The air never dropped below ${lowestAir} out of 100.`);
  }
  if (state.mission.id === "conjunction2019") {
    const silent = outcomes.filter((outcome) => {
      const plan = planOf(state.mission.id);
      return plan.blackout !== null && outcome.sol >= plan.blackout[0] && outcome.sol <= plan.blackout[1];
    }).length;
    if (silent > 0) lines.push(`For ${silent} sols Mission Control could not reach you. You ran the outpost alone.`);
  }
  if (state.mission.id === "dust2018") {
    lines.push(
      "In this same storm, the solar-powered Opportunity rover ran out of power. It never woke up again.",
      "Curiosity runs on nuclear power, so it kept working. It recorded the weather you just played.",
    );
  }
  lines.push(tradeLine(state));

  return {
    headline: state.ending === "crewLost" ? "The crew had to be evacuated." : "All four crew made it through.",
    lines,
    carefulCommander: playWith(state.mission.id, state.seed, carefulBet).score,
  };
}

const REMS_SOURCE =
  "Curiosity rover REMS weather station, Gale Crater. NASA/JPL-Caltech/CAB (CSIC-INTA). https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json";

function rules(): RuleCard[] {
  const kWh = (wh: number) => `${wh / 1000} kWh`;
  return [
    {
      id: "sunlight",
      title: "Sunlight",
      plain: "How much sunlight reached the ground that sol, measured by the Curiosity rover.",
      formula: "The rover's ultraviolet index: Low, Moderate, High or Very High.",
      kind: "NASA measurement",
      source: REMS_SOURCE,
    },
    {
      id: "sol-date",
      title: "Sol number and Earth date",
      plain: "Every sol you play really happened. This is the rover's count of Mars days since it landed.",
      formula: "Sol 0 is the day Curiosity landed, 6 August 2012.",
      kind: "NASA measurement",
      source: REMS_SOURCE,
    },
    {
      id: "battery",
      title: "Battery",
      plain: "Solar energy you do not spend is stored for the night. Extra energy is lost when it is full.",
      formula: `Holds ${kWh(RULES.BATTERY_CAPACITY_WH)}. Starts at ${kWh(RULES.START_BATTERY_WH)}. Sunset = battery + solar − computer − greenhouse.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "food",
      title: "Food",
      plain: "The crew eats every sol. Fresh food comes only from the greenhouse.",
      formula: `${RULES.MEALS_PER_SOL} meals a sol for four crew. The pantry starts with ${RULES.START_MEALS}.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "health",
      title: "Crew health",
      plain: "Cold nights, thin air and hunger hurt the crew. Good sols help them recover.",
      formula: `−${RULES.HEALTH_PER_COLD_HOUR} for each cold hour (at most −${RULES.HEALTH_COLD_CAP}), −${RULES.HEALTH_PER_AIR_POINT} for each air point under ${RULES.AIR_WARNING}, −${RULES.HEALTH_HUNGRY} when hungry, +${RULES.HEALTH_RECOVER} on a good sol. At 0 the crew is evacuated.`,
      kind: "game rule",
      source: null,
    },
    {
      id: "forecast",
      title: "Mission Control's forecast",
      plain: "Radio takes minutes to reach Mars, and the team needs time to work. So their forecast uses data from yesterday.",
      formula: "Copycat, Averager, Season Memory and Trend Line, blended by how well each did lately, on data one sol old.",
      kind: "game rule",
      source: null,
    },
    {
      id: "conjunction",
      title: "Solar conjunction",
      plain: "Sometimes the Sun sits between Earth and Mars. Its glow can scramble radio, so NASA stops sending commands.",
      formula: "In 2019 NASA held all commands to its Mars missions from 28 August to 7 September (sols 2509 to 2519).",
      kind: "NASA measurement",
      source: "NASA/JPL, \"What's Mars Solar Conjunction, and Why Does It Matter?\" https://www.jpl.nasa.gov/news/whats-mars-solar-conjunction-and-why-does-it-matter/",
    },
    {
      id: "opportunity",
      title: "The Opportunity rover",
      plain: "A solar-powered rover in another part of Mars. The 2018 dust storm blocked its sunlight and it never woke up.",
      formula: "Last message 10 June 2018. NASA ended the mission on 13 February 2019 after more than 1,000 unanswered calls.",
      kind: "NASA measurement",
      source: "NASA, \"NASA's Record-Setting Opportunity Rover Mission on Mars Comes to End\" https://www.nasa.gov/news-release/nasas-record-setting-opportunity-rover-mission-on-mars-comes-to-end/",
    },
    {
      id: "score",
      title: "Score",
      plain: "Points for a healthy crew, food you grew, and power left at the end.",
      formula: "Crew health × 5 + meals grown × 2 + 20 for each spare night of battery (at most 3).",
      kind: "game rule",
      source: null,
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
      source: REMS_SOURCE,
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

  // Every start sol a seed can pick, for every mission.
  const everySeed = (plan: MissionPlan) => Array.from({ length: plan.startMax - plan.startMin + 1 }, (_, seed) => seed);

  check("the careful commander survives every mission on every seed", () => {
    for (const plan of MISSIONS) {
      for (const seed of everySeed(plan)) {
        const end = playWith(plan.id, seed, carefulBet);
        if (end.ending !== "survived") return `${plan.id} seed ${seed}: ${end.ending} on sol ${end.solIndex + 1}`;
      }
    }
    return true;
  });

  check("spending everything loses the dust storm on every seed", () => {
    const plan = planOf("dust2018");
    for (const seed of everySeed(plan)) {
      const end = playWith(plan.id, seed, greedy);
      if (end.ending !== "crewLost") return `seed ${seed}: greedy play ${end.ending}, health ${end.outpost.crewHealth}`;
    }
    return true;
  });

  check("hoarding every watt loses every mission", () => {
    for (const plan of MISSIONS) {
      const end = playWith(plan.id, 2, () => ({ huddle: false, greenhouseWh: 0 }));
      if (end.ending !== "crewLost") return `${plan.id}: spending nothing ${end.ending}`;
    }
    return true;
  });

  check("story lines are short and name the crew", () => {
    const end = playWith("dust2018", 2, carefulBet);
    const lines = end.outcomes.flatMap((outcome) => outcome.story);
    const long = lines.find((line) => line.split(/\s+/).length > 12);
    if (long) return `too long: "${long}"`;
    return CREW.every((member) => lines.some((line) => line.includes(member.name))) ? true : "a crew member is never named";
  });

  check("guided calm mission gives a hint on its first sols", () => {
    let state = reduce(start("calm2016", 1, "guided"), { type: "goToBet" });
    state = reduce(state, { type: "lockBet" });
    return state.outcomes[0].story.some((line) => line.startsWith("Tip:")) ? true : "no hint on sol 1";
  });

  check("rule cards have unique ids and every NASA card has a source", () => {
    const cards = rules();
    const ids = new Set(cards.map((card) => card.id));
    if (ids.size !== cards.length) return "two cards share an id";
    const missing = cards.find((card) => card.kind === "NASA measurement" && !card.source);
    return missing ? `${missing.id} has no source` : true;
  });

  check("mission codes round-trip and call signs are friendly", () => {
    const state = start("dust2018", 4, "builder");
    const parsed = parseMissionCode(missionCode(state));
    if (!parsed || parsed.missionId !== "dust2018" || parsed.seed !== 4) return "mission code did not round-trip";
    if (parseMissionCode("mars-1") !== null) return "accepted an unknown mission";
    return /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/.test(makeCallSign(7)) ? true : `bad call sign ${makeCallSign(7)}`;
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

export { entryFor, leaderboard, makeCallSign, missionCode, parseMissionCode } from "./leaderboard";

export const game: GameApi = {
  missions: () => MISSIONS.map(publicInfo),
  start,
  reduce,
  whatIf,
  debrief,
  rules,
  selfCheck,
};
