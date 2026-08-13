// ============================================================
// OOZE RUSH — central balance / config file
// Every tunable economy number lives here so the game is easy
// to rebalance without touching game logic.
// ============================================================

export const CURRENCY = {
  main: 'Goo',
  prestige: 'Crystals',
};

// ---- Click / tap action -------------------------------------------------
export const CLICK = {
  baseValue: 1,
  // click power upgrade: value = base * (1 + level * perLevel) * flatMultiplier
  perLevelBonus: 0.35,
  baseCost: 15,
  costGrowth: 1.16,
  comboWindow: 1.1, // seconds between clicks to keep combo alive
  comboStep: 0.06, // +6% per combo stack
  comboMax: 25, // cap at +150%
};

// ---- Character upgrades --------------------------------------------------
export const CHAR_UPGRADES = {
  clickPower: {
    name: 'Tap Power',
    icon: 'bolt',
    baseCost: 15,
    costGrowth: 1.16,
    effectPerLevel: 0.35,
    desc: 'Increase Goo earned per tap',
    max: 200,
  },
  moveSpeed: {
    name: 'Swift Ooze',
    icon: 'chevronsRight',
    baseCost: 40,
    costGrowth: 1.22,
    effectPerLevel: 0.09,
    desc: 'Move faster around the map',
    max: 20,
  },
  capacity: {
    name: 'Storage Sac',
    icon: 'flask',
    baseCost: 80,
    costGrowth: 1.25,
    effectPerLevel: 0.5,
    desc: 'Increase offline earnings cap',
    max: 40,
  },
  multiplier: {
    name: 'Goo Density',
    icon: 'sparkle',
    baseCost: 500,
    costGrowth: 1.35,
    effectPerLevel: 0.12,
    desc: 'Boost ALL Goo income',
    max: 100,
  },
};

// ---- Tycoon machines ------------------------------------------------------
// Each machine sits on a purchase pad. Owning N of a machine multiplies
// its base production. Machines also have an independent level upgrade
// that increases per-unit output.
export const MACHINES = [
  {
    id: 'extractor',
    name: 'Goo Extractor',
    icon: 'fuelPump',
    desc: 'Pulls raw Goo from the puddle floor',
    baseCost: 50,
    costGrowth: 1.15,
    baseOutput: 1.2, // goo / sec per unit
    unlockAt: 0,
    color: 0x6ee7b7,
    maxCount: 25,
  },
  {
    id: 'splitter',
    name: 'Splitter Node',
    icon: 'shuffleX',
    desc: 'Splits Goo blobs into more Goo blobs',
    baseCost: 400,
    costGrowth: 1.17,
    baseOutput: 6,
    unlockAt: 250,
    color: 0x60a5fa,
    maxCount: 20,
  },
  {
    id: 'worker',
    name: 'Worker Blob',
    icon: 'user',
    desc: 'Auto-taps the Goo Blob for you',
    baseCost: 1500,
    costGrowth: 1.19,
    baseOutput: 18,
    unlockAt: 1000,
    color: 0xfbbf24,
    maxCount: 15,
  },
  {
    id: 'geyser',
    name: 'Goo Geyser',
    icon: 'volcano',
    desc: 'Erupts with huge bursts of Goo',
    baseCost: 12000,
    costGrowth: 1.21,
    baseOutput: 85,
    unlockAt: 8000,
    color: 0xf472b6,
    maxCount: 12,
  },
  {
    id: 'refinery',
    name: 'Crystal Refinery',
    icon: 'factory',
    desc: 'Industrial-scale Goo refinement',
    baseCost: 120000,
    costGrowth: 1.23,
    baseOutput: 520,
    unlockAt: 60000,
    color: 0xa78bfa,
    maxCount: 10,
  },
  {
    id: 'reactor',
    name: 'Void Reactor',
    icon: 'atom',
    desc: 'Harnesses void energy for absurd output',
    baseCost: 2500000,
    costGrowth: 1.26,
    baseOutput: 4200,
    unlockAt: 1200000,
    color: 0x22d3ee,
    maxCount: 8,
  },
];

// Tycoon-wide upgrades (affect all machines)
export const TYCOON_UPGRADES = {
  prodSpeed: {
    name: 'Conveyor Speed',
    icon: 'gauge',
    baseCost: 300,
    costGrowth: 1.3,
    effectPerLevel: 0.08,
    desc: 'All machines produce faster',
    max: 30,
  },
  machineValue: {
    name: 'Machine Tuning',
    icon: 'wrench',
    baseCost: 600,
    costGrowth: 1.32,
    effectPerLevel: 0.1,
    desc: 'Increase output value per machine',
    max: 30,
  },
  workerEff: {
    name: 'Worker Efficiency',
    icon: 'clock',
    baseCost: 2000,
    costGrowth: 1.3,
    effectPerLevel: 0.15,
    desc: 'Workers & automation earn more',
    max: 25,
  },
};

// ---- Zones -----------------------------------------------------------------
export const ZONES = [
  { id: 'puddle', name: 'Puddle Park', cost: 0, color: 0x8ee6c8, fog: 0xbff2e0, sky: 0xaef1e0 },
  { id: 'sewers', name: 'Neon Sewers', cost: 10000, color: 0x7c5cff, fog: 0x1c1035, sky: 0x120821 },
  { id: 'caverns', name: 'Crystal Caverns', cost: 250000, color: 0x59d1ff, fog: 0x0c1f33, sky: 0x08141f },
  { id: 'tundra', name: 'Frozen Tundra', cost: 5000000, color: 0xdbeeff, fog: 0xcfe9ff, sky: 0xd8f0ff },
  { id: 'magma', name: 'Magma Core', cost: 100000000, color: 0xff6b3d, fog: 0x2a0a05, sky: 0x1a0503 },
  { id: 'void', name: 'The Void', cost: 5000000000, color: 0xff2fd4, fog: 0x05030f, sky: 0x020108 },
];

// ---- Rebirth / Prestige ------------------------------------------------------
export const PRESTIGE = {
  unlockAt: 1000000, // lifetime goo needed to unlock rebirth
  crystalsFromLifetime: (lifetimeGoo) => Math.floor(Math.sqrt(lifetimeGoo / 500000)),
  multiplierPerCrystal: 0.02, // permanent +2% goo per crystal
  upgrades: {
    startBoost: {
      name: 'Head Start',
      icon: 'rocket',
      baseCost: 3,
      costGrowth: 1.6,
      effectPerLevel: 250, // free goo granted immediately after each rebirth
      desc: 'Start each life with bonus Goo',
      max: 25,
    },
    permaMult: {
      name: 'Ooze Ascendance',
      icon: 'crown',
      baseCost: 5,
      costGrowth: 1.8,
      effectPerLevel: 0.05,
      desc: 'Permanently boost all Goo income',
      max: 50,
    },
    clickBoost: {
      name: 'Crystal Fingers',
      icon: 'crystal',
      baseCost: 4,
      costGrowth: 1.7,
      effectPerLevel: 0.08,
      desc: 'Permanently boost tap power',
      max: 40,
    },
  },
};

// ---- Quests ------------------------------------------------------------------
export const QUEST_POOL = [
  { id: 'earn_1', type: 'earn', amount: 500, reward: 250, text: (a) => `Earn ${a} Goo` },
  { id: 'earn_2', type: 'earn', amount: 5000, reward: 2000, text: (a) => `Earn ${a} Goo` },
  { id: 'earn_3', type: 'earn', amount: 50000, reward: 15000, text: (a) => `Earn ${a} Goo` },
  { id: 'click_1', type: 'click', amount: 50, reward: 300, text: (a) => `Tap the Goo Blob ${a} times` },
  { id: 'click_2', type: 'click', amount: 200, reward: 1200, text: (a) => `Tap the Goo Blob ${a} times` },
  { id: 'buy_1', type: 'buy', amount: 3, reward: 400, text: (a) => `Buy ${a} upgrades or machines` },
  { id: 'buy_2', type: 'buy', amount: 8, reward: 3000, text: (a) => `Buy ${a} upgrades or machines` },
  { id: 'machine_1', type: 'machine', amount: 1, reward: 500, text: () => `Unlock a new machine` },
  { id: 'lucky_1', type: 'lucky', amount: 1, reward: 600, text: () => `Collect a Lucky Drop` },
];

// ---- Random events ---------------------------------------------------------
export const EVENTS = {
  luckyBlobChance: 0.12, // chance per spawn cycle
  luckyBlobInterval: [18, 35], // seconds range between spawn attempts
  luckyBlobRewardRange: [50, 400], // flat goo, scaled by production later
  goldenWindowChance: 0.05,
  goldenWindowInterval: [45, 90],
  goldenWindowDuration: 15,
  goldenWindowMult: 2,
};

// ---- Misc --------------------------------------------------------------------
export const SAVE_KEY = 'ooze_rush_save_v1';
export const AUTOSAVE_INTERVAL = 15000; // ms
export const OFFLINE_CAP_BASE_HOURS = 2;
