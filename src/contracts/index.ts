/**
 * Shared contracts. Part A (brain), Part B (UI) and Part C (game) meet here and nowhere else.
 *
 * Rules:
 * - Nobody changes this file alone. Post the change in the team chat first; every change here can break
 *   the other two parts.
 * - Adding an optional field is safe. Renaming, removing or changing the meaning of a field is not.
 * - Everything in here must survive JSON.stringify / JSON.parse (saves and leaderboard replays depend on it).
 *
 * Units, used everywhere: temperature in degrees Celsius (C), energy in watt-hours (Wh), time in sols
 * (one Mars day, 24.66 hours).
 */

/* ------------------------------------------------------------------ */
/* NASA data                                                           */
/* ------------------------------------------------------------------ */

export type UvIndex = "Low" | "Moderate" | "High" | "Very_High";

/** One sol of real weather from the Curiosity rover's REMS station at Gale Crater. */
export type SolReading = {
  /** Mars days since Curiosity landed. */
  sol: number;
  earthDate: string | null;
  /** Overnight low, air temperature. null when the rover sent no reading. */
  minTempC: number | null;
  /** Daytime high, air temperature. */
  maxTempC: number | null;
  pressurePa: number | null;
  /** The rover's measured ultraviolet index: how much sunlight reached the ground. */
  uvIndex: UvIndex | null;
  /** Hours between sunrise and sunset. */
  daylightHours: number | null;
  /** Solar longitude, 0 to 360: where Mars is in its year (its season). */
  solarLongitude: number | null;
};

/** A NASA DONKI model run that predicted a solar eruption reaching Mars. */
export type StormAlert = {
  /** The sol the eruption was predicted to arrive. */
  sol: number;
  arrivalUtc: string;
  eruptionUtc: string | null;
  speedKmS: number | null;
  /** True when the model predicted only a glancing blow. */
  glancing: boolean;
  /** Link to the DONKI record, shown to the player as the source. */
  link: string | null;
};

/* ------------------------------------------------------------------ */
/* Part A: the brain (forecasting tools)                               */
/* ------------------------------------------------------------------ */

export type ToolId =
  | "copycat"
  | "averager"
  | "season"
  | "trend"
  // Advanced Lab only. Never needed to finish a mission.
  | "neurons"
  | "spotlight"
  | "longMemory";

/** A setting the player can change on a tool, shown as a slider. */
export type ToolKnob = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
};

export type ToolInfo = {
  id: ToolId;
  /** Kid name: "Copycat". */
  name: string;
  /** Grown-up name: "persistence forecast". Shown small, under the kid name. */
  realName: string;
  /** One sentence a nine-year-old can read. */
  blurb: string;
  /** Energy the outpost computer spends running this tool for one sol. A game rule, not physics. */
  energyWhPerSol: number;
  knobs: ToolKnob[];
  /** True when train() fits numbers for this tool. */
  learns: boolean;
  /** True for Advanced Lab tools, which the core game never shows. */
  advanced: boolean;
  /** False until Part A has built it. The UI shows unready tools as locked. */
  ready: boolean;
};

export type ToolInstance = {
  /** Unique within one design. The UI makes it; any string works. */
  uid: string;
  id: ToolId;
  /** Knob values by key. Missing keys use the knob's initial value. */
  knobs: Record<string, number>;
};

/** The tools installed on the outpost computer. Order is display order only. */
export type BrainDesign = { tools: ToolInstance[] };

/**
 * What a brain forecasts.
 * - "nightLowC": tonight's overnight low, in degrees C.
 * - "sunlight": tomorrow's sunlight level, 1 (Low) to 4 (Very High), from the rover's ultraviolet index.
 */
export type Target = "nightLowC" | "sunlight";

/** A forecast. low to high is the range the brain expects 8 times in 10. Units depend on the target. */
export type Forecast = { target: Target; value: number; low: number; high: number };

export type TrainedBrain = {
  design: BrainDesign;
  target: Target;
  /** How much the brain trusts each tool, in design order. Each 0 to 1; they sum to 1. */
  trust: number[];
  energyWhPerSol: number;
  /** The last sol the brain has seen. */
  trainedThroughSol: number;
  /** Owned by Part A. Nobody else reads it. Must survive JSON. */
  internals: unknown;
};

export type GuessPoint = { sol: number; actual: number | null; guess: number | null };

/** The result of trying a design on sols it was not trained on. Units depend on the target. */
export type TestFlight = {
  target: Target;
  /** Average distance between guess and truth. Lower is better. */
  averageMiss: number;
  /** How far averageMiss could be off by chance (one standard error). Show it as "give or take". */
  missNoise: number;
  /** Average miss of "same as last time" on the same sols, for comparison. */
  copycatMiss: number;
  worstMiss: number;
  energyWhPerSol: number;
  points: GuessPoint[];
  /** For each tool: how much worse the brain gets without it. Positive means the tool helps. */
  toolHelp: { uid: string; help: number }[];
};

export type CheckResult = { name: string; pass: boolean; detail: string };

/**
 * Part A implements this in src/brain and exports it as `brain`.
 *
 * Promises:
 * - Pure and deterministic: the same inputs and seed give the same output. No Math.random, no Date, no network.
 * - Reads only the `history` it is given. The game never passes a sol the player has not seen yet.
 * - `history` is in sol order and may contain null readings and missing sols. Handle both.
 * - train() and testFlight() return within 150 ms for 1,000 sols of history on a school laptop.
 * - An empty design behaves as Copycat alone.
 * - Never throws on valid input, never returns NaN or Infinity.
 */
export interface BrainApi {
  catalog(): ToolInfo[];
  energy(design: BrainDesign): number;
  train(design: BrainDesign, history: SolReading[], target: Target, seed: number): TrainedBrain;
  /** Forecast the target for the sol after the last one in `history`. */
  predict(brain: TrainedBrain, history: SolReading[]): Forecast;
  /** Walk forward over the last `testSols` sols of `history`, always training only on earlier sols. */
  testFlight(design: BrainDesign, history: SolReading[], target: Target, testSols: number, seed: number): TestFlight;
  /** One tool's guesses over the last `lastSols` sols, for the chart in the Brain Bay. */
  preview(tool: ToolInstance, history: SolReading[], target: Target, lastSols: number): GuessPoint[];
  selfCheck(): CheckResult[];
}

/* ------------------------------------------------------------------ */
/* Part C: the game (missions, rules, scoring)                         */
/* ------------------------------------------------------------------ */

export type MissionId = "calm2016" | "conjunction2019" | "dust2018";

export type MissionInfo = {
  id: MissionId;
  title: string;
  /** Two sentences, reading age about nine. */
  blurb: string;
  /** What really happened, in one or two sentences, or null for an ordinary stretch. */
  realEvent: string | null;
  lengthSols: number;
  difficulty: 1 | 2 | 3;
  ready: boolean;
};

/** guided: ages 7-9, Mission Control's forecast only. builder: ages 9-12, tools too. lab: Advanced Lab tools too. */
export type Mode = "guided" | "builder" | "lab";

/** report: morning data is shown. bet: the player decides. night: the real result is shown. */
export type Phase = "report" | "bet" | "night" | "ended";

/** normal: Mission Control sends a forecast every sol. blackout: solar conjunction, no contact with Earth. */
export type Contact = "normal" | "blackout";

/** The player's decision for one sol. Energy that is not spent stays in the battery for the night. */
export type Bet = {
  /** Energy for the greenhouse lights today. Ignored (treated as 0) when huddle is true. */
  greenhouseWh: number;
  /** Emergency: the crew moves into one room and the greenhouse is powered down for the sol. */
  huddle: boolean;
};

export type Outpost = {
  /** 0 to 100, shared by the four crew. The mission ends at 0. */
  crewHealth: number;
  batteryWh: number;
  /** Breathable air, 0 to 100. */
  airPercent: number;
  /** Meals in the pantry. */
  meals: number;
  /** Light the current crop has collected so far. It is harvested at cropNeedsWh. */
  cropLightWh: number;
  cropNeedsWh: number;
  /** Sols in a row the crop got too little light. The crop dies at 2. */
  cropStarvedSols: number;
};

/** Both forecasts a source gives each sol. */
export type ForecastPair = {
  /** Tonight's overnight low, degrees C. */
  nightLow: Forecast;
  /** Tomorrow's sunlight level, 1 (Low) to 4 (Very High). */
  sunlightTomorrow: Forecast;
};

export type SolOutcome = {
  sol: number;
  earthDate: string | null;
  bet: Bet;
  /** Today's real sunlight. */
  sunlight: UvIndex;
  /** The real measured overnight low. */
  actualLowC: number;
  solarWh: number;
  computerWh: number;
  batteryAtSunsetWh: number;
  /** Energy the outpost needed to get through the night: heat, fans and air scrubbers. */
  keepAliveWh: number;
  /** Hours before sunrise with no power left. 0 is a good night. */
  hoursCold: number;
  airMade: number;
  airUsed: number;
  mealsEaten: number;
  /** Meals added to the pantry by a harvest this sol, usually 0. */
  mealsHarvested: number;
  cropDied: boolean;
  healthChange: number;
  outpostAfter: Outpost;
  /** Plain sentences for the night screen, reading age about nine. */
  story: string[];
};

export type Score = {
  total: number;
  crewHealth: number;
  mealsHarvested: number;
  /** Nights the outpost could still survive on the battery alone when the mission ended. */
  spareNights: number;
};

export type GameState = {
  version: 1;
  mission: MissionInfo;
  seed: number;
  mode: Mode;
  phase: Phase;
  /** 0 for the first sol of the mission. */
  solIndex: number;
  /** The sol being played. Its overnight low is hidden until the bet is locked. */
  todaySol: number;
  todayEarthDate: string | null;
  /** Today's real sunlight, known in the morning. */
  sunlight: UvIndex;
  /** Every full reading the player may see: all sols before today. */
  history: SolReading[];
  contact: Contact;
  outpost: Outpost;
  /** Energy the panels collect today. */
  solarWh: number;
  /** Energy the computer uses today for the installed tools. */
  computerWh: number;
  /** The most the greenhouse can use today. */
  maxGreenhouseWh: number;
  design: BrainDesign;
  /** Mission Control's forecast, made from data that is one sol old. null during a blackout. */
  earthForecast: ForecastPair | null;
  /** The outpost computer's forecast, from the installed tools. null when no tool is installed. */
  outpostForecast: ForecastPair | null;
  bet: Bet;
  /** Tools the player may install in this mode. */
  availableTools: ToolId[];
  outcomes: SolOutcome[];
  score: Score;
  ending: null | "survived" | "crewLost";
  /** Set when the last action was refused, in words the player can read. null otherwise. */
  problem: string | null;
};

export type Action =
  /** Change the installed tools. Refreshes outpostForecast and computerWh. Allowed in report and bet. */
  | { type: "setDesign"; design: BrainDesign }
  /** report -> bet */
  | { type: "goToBet" }
  /** Update the draft bet. Allowed in bet. */
  | { type: "setBet"; bet: Bet }
  /** bet -> night. Reveals the real low and applies the consequences. */
  | { type: "lockBet" }
  /** night -> report of the next sol, or -> ended. */
  | { type: "nextSol" }
  /**
   * night -> a later night. Replays the same bet on the following sols and stops when the sunlight
   * changes, contact changes, a gauge reaches a warning level, a crop is harvested, or the mission ends.
   * Keeps a 30-sol mission to about ten minutes.
   */
  | { type: "fastForward" };

/** What a bet would lead to if the night turned out a given temperature. For the live preview on the bet screen. */
export type WhatIf = {
  batteryAtSunsetWh: number;
  keepAliveWh: number;
  hoursCold: number;
  airAfter: number;
  cropLightAfterWh: number;
  /** The coldest night the battery at sunset can cover, degrees C. */
  coveredDownToC: number;
  /** Nights like this one the battery could cover with no sunlight at all. */
  spareNights: number;
};

/** One line of the "How it works" page, and the source shown when a number is tapped. */
export type RuleCard = {
  /** Stable key, so the UI can link a number on screen to its card. */
  id: string;
  title: string;
  /** The rule in plain words. */
  plain: string;
  /** The formula with its numbers. */
  formula: string;
  kind: "NASA measurement" | "physics" | "game rule";
  /** Where the number comes from, with a link when there is one. */
  source: string | null;
};

/** The end-of-mission card. Physical facts first, comparisons second. */
export type Debrief = {
  headline: string;
  /** Plain sentences, reading age about nine. */
  lines: string[];
  /** The same mission played by a careful commander who follows a simple rule and cannot see the future. */
  carefulCommander: Score;
};

/**
 * Part C implements this in src/game and exports it as `game`.
 *
 * Promises:
 * - reduce() is pure: it never changes the state it was given, and the same state and action give the same result.
 * - An action that is not allowed returns the same state with `problem` set. reduce() never throws.
 * - The real low for todaySol never appears anywhere in GameState until the phase is "night".
 * - Deterministic for a given mission, seed and mode. The start sol is hidden: it is picked from the seed.
 * - GameState survives JSON.stringify / JSON.parse.
 */
export interface GameApi {
  missions(): MissionInfo[];
  start(missionId: MissionId, seed: number, mode: Mode): GameState;
  reduce(state: GameState, action: Action): GameState;
  whatIf(state: GameState, bet: Bet, nightLowC: number): WhatIf;
  debrief(state: GameState): Debrief;
  rules(): RuleCard[];
  selfCheck(): CheckResult[];
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export type LeaderboardEntry = {
  /** A generated call sign such as "Brave Comet 42". Never a real name: players may be children. */
  callSign: string;
  missionId: MissionId;
  seed: number;
  score: number;
  crewHealth: number;
  mealsHarvested: number;
  toolsUsed: ToolId[];
  classCode: string | null;
  /** ISO time the run ended. */
  at: string;
};

export interface LeaderboardApi {
  submit(entry: LeaderboardEntry): Promise<void>;
  /** Best first, at most `limit` entries. */
  top(missionId: MissionId, seed: number, classCode: string | null, limit: number): Promise<LeaderboardEntry[]>;
}
