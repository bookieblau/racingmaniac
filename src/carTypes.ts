export type CarTypeId =
  | "buggy" | "monster" | "racer" | "crawler"
  | "dirtbike" | "sportbike" | "chopper";

export type VehicleKind = "car" | "bike";

export interface CarConfig {
  id: CarTypeId;
  kind: VehicleKind;
  name: string;
  description: string;
  bodyColorHex: string;
  // ── Physics ──────────────────────────────────────────────────────────────
  maxSpeed: number;
  acceleration: number;
  brake: number;
  steerSpeed: number;
  // ── Geometry ─────────────────────────────────────────────────────────────
  wheelRadius: number;
  wheelThickness: number;
  axleY: number;       // local Y of axle centre (= wheelRadius for flat ground)
  frontAxleZ: number;  // +Z = forward
  rearAxleZ: number;   // −Z = behind
  axleX: number;       // half-track width (0 for bikes)
  carBottomOffset: number;
  // ── Slope grip ────────────────────────────────────────────────────────────
  // Lower = better hill-climbing.  The challenge hill requires ≤ 0.6 to summit.
  slopeDragMult: number;
  // ── HUD stat bars (0–100) ─────────────────────────────────────────────────
  statSpeed: number;
  statHandling: number;
  statPower: number;
}

export const CAR_CONFIGS: Record<CarTypeId, CarConfig> = {
  buggy: {
    id: "buggy",
    kind: "car",
    name: "Dune Buggy",
    description: "Balanced all-rounder built for the desert",
    bodyColorHex: "#c72822",
    maxSpeed: 34, acceleration: 28, brake: 40, steerSpeed: 2.8,
    wheelRadius: 0.52, wheelThickness: 0.30,
    axleY: 0.52, frontAxleZ: 1.32, rearAxleZ: -1.28, axleX: 1.12,
    carBottomOffset: 0.04,
    slopeDragMult: 2.2,
    statSpeed: 75, statHandling: 80, statPower: 70,
  },

  monster: {
    id: "monster",
    kind: "car",
    name: "Monster Truck",
    description: "Massive wheels, earth-shaking power",
    bodyColorHex: "#1465c0",
    maxSpeed: 24, acceleration: 24, brake: 34, steerSpeed: 1.9,
    wheelRadius: 0.78, wheelThickness: 0.44,
    axleY: 0.78, frontAxleZ: 1.55, rearAxleZ: -1.50, axleX: 1.42,
    carBottomOffset: 0.06,
    slopeDragMult: 2.0,
    statSpeed: 50, statHandling: 45, statPower: 95,
  },

  racer: {
    id: "racer",
    kind: "car",
    name: "Desert Racer",
    description: "Built for pure speed across open sand",
    bodyColorHex: "#cc8800",
    maxSpeed: 46, acceleration: 38, brake: 52, steerSpeed: 2.3,
    wheelRadius: 0.42, wheelThickness: 0.24,
    axleY: 0.42, frontAxleZ: 1.65, rearAxleZ: -1.58, axleX: 1.08,
    carBottomOffset: 0.03,
    slopeDragMult: 2.7,
    statSpeed: 100, statHandling: 65, statPower: 85,
  },

  crawler: {
    id: "crawler",
    kind: "car",
    name: "Rock Crawler",
    description: "Slow and steady, grips any terrain",
    bodyColorHex: "#4a6e2a",
    maxSpeed: 18, acceleration: 18, brake: 28, steerSpeed: 3.5,
    wheelRadius: 0.62, wheelThickness: 0.38,
    axleY: 0.62, frontAxleZ: 1.22, rearAxleZ: -1.20, axleX: 1.28,
    carBottomOffset: 0.05,
    slopeDragMult: 0.55,
    statSpeed: 40, statHandling: 95, statPower: 80,
  },

  dirtbike: {
    id: "dirtbike",
    kind: "bike",
    name: "Dirt Bike",
    description: "Light and nimble — jumps dunes with ease",
    bodyColorHex: "#2d8a1e",
    maxSpeed: 40, acceleration: 34, brake: 44, steerSpeed: 4.2,
    wheelRadius: 0.40, wheelThickness: 0.14,
    axleY: 0.40, frontAxleZ: 0.95, rearAxleZ: -0.78, axleX: 0,
    carBottomOffset: 0.02,
    slopeDragMult: 1.6,
    statSpeed: 85, statHandling: 90, statPower: 60,
  },

  sportbike: {
    id: "sportbike",
    kind: "bike",
    name: "Sport Bike",
    description: "Blazing fast on flat sand, tricky on slopes",
    bodyColorHex: "#d01020",
    maxSpeed: 52, acceleration: 42, brake: 55, steerSpeed: 3.9,
    wheelRadius: 0.36, wheelThickness: 0.12,
    axleY: 0.36, frontAxleZ: 1.05, rearAxleZ: -0.88, axleX: 0,
    carBottomOffset: 0.02,
    slopeDragMult: 2.8,
    statSpeed: 100, statHandling: 75, statPower: 70,
  },

  chopper: {
    id: "chopper",
    kind: "bike",
    name: "Desert Chopper",
    description: "Long forks, laid-back cruise across the sand",
    bodyColorHex: "#e86820",
    maxSpeed: 30, acceleration: 22, brake: 36, steerSpeed: 2.4,
    wheelRadius: 0.46, wheelThickness: 0.16,
    axleY: 0.46, frontAxleZ: 1.30, rearAxleZ: -0.92, axleX: 0,
    carBottomOffset: 0.03,
    slopeDragMult: 1.9,
    statSpeed: 55, statHandling: 55, statPower: 75,
  },
};

export const CAR_IDS: CarTypeId[] = ["buggy", "monster", "racer", "crawler"];
export const BIKE_IDS: CarTypeId[] = ["dirtbike", "sportbike", "chopper"];
