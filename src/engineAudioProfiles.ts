import type { CarTypeId } from "./carTypes";

export type EngineSoundProfile = {
  /** Display / debug label */
  label: string;
  idleHz: number;
  redlineHz: number;
  mainWave: OscillatorType;
  harmWave: OscillatorType;
  /** Second oscillator as a multiple of base RPM tone */
  harmRatio: number;
  harmLevel: number;
  /** Sub-harmonic (V8 / diesel thump) */
  subLevel: number;
  /** Filtered intake / exhaust hiss */
  noiseLevel: number;
  filterIdle: number;
  filterWide: number;
  /** 2-stroke power-pulse on the exhaust note */
  twoStrokePulse: boolean;
  /** Extra noise under load (race engines, trucks) */
  loadRasp: number;
};

export const ENGINE_SOUND_PROFILES: Record<CarTypeId, EngineSoundProfile> = {
  buggy: {
    label: "Air-cooled flat-4",
    idleHz: 78,
    redlineHz: 290,
    mainWave: "triangle",
    harmWave: "sawtooth",
    harmRatio: 2.02,
    harmLevel: 0.32,
    subLevel: 0.12,
    noiseLevel: 0.06,
    filterIdle: 520,
    filterWide: 2200,
    twoStrokePulse: false,
    loadRasp: 0.08,
  },
  monster: {
    label: "Big-block V8",
    idleHz: 48,
    redlineHz: 195,
    mainWave: "sawtooth",
    harmWave: "square",
    harmRatio: 0.5,
    harmLevel: 0.38,
    subLevel: 0.55,
    noiseLevel: 0.1,
    filterIdle: 340,
    filterWide: 1400,
    twoStrokePulse: false,
    loadRasp: 0.22,
  },
  racer: {
    label: "Race trophy truck V6",
    idleHz: 92,
    redlineHz: 360,
    mainWave: "sawtooth",
    harmWave: "sawtooth",
    harmRatio: 1.5,
    harmLevel: 0.28,
    subLevel: 0.06,
    noiseLevel: 0.18,
    filterIdle: 680,
    filterWide: 4200,
    twoStrokePulse: false,
    loadRasp: 0.35,
  },
  crawler: {
    label: "Torquey diesel 4-cyl",
    idleHz: 42,
    redlineHz: 155,
    mainWave: "square",
    harmWave: "triangle",
    harmRatio: 0.5,
    harmLevel: 0.22,
    subLevel: 0.48,
    noiseLevel: 0.05,
    filterIdle: 280,
    filterWide: 1100,
    twoStrokePulse: false,
    loadRasp: 0.12,
  },
  dirtbike: {
    label: "2-stroke single",
    idleHz: 118,
    redlineHz: 430,
    mainWave: "sawtooth",
    harmWave: "square",
    harmRatio: 2,
    harmLevel: 0.4,
    subLevel: 0.04,
    noiseLevel: 0.22,
    filterIdle: 900,
    filterWide: 4800,
    twoStrokePulse: true,
    loadRasp: 0.28,
  },
  sportbike: {
    label: "Inline-4 screamer",
    idleHz: 105,
    redlineHz: 510,
    mainWave: "sawtooth",
    harmWave: "sawtooth",
    harmRatio: 2,
    harmLevel: 0.35,
    subLevel: 0.03,
    noiseLevel: 0.14,
    filterIdle: 820,
    filterWide: 6200,
    twoStrokePulse: false,
    loadRasp: 0.2,
  },
  chopper: {
    label: "V-twin cruiser",
    idleHz: 58,
    redlineHz: 245,
    mainWave: "triangle",
    harmWave: "sawtooth",
    harmRatio: 0.92,
    harmLevel: 0.42,
    subLevel: 0.35,
    noiseLevel: 0.08,
    filterIdle: 400,
    filterWide: 1800,
    twoStrokePulse: false,
    loadRasp: 0.1,
  },
};
