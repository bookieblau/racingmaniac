export type CarTypeId = "buggy" | "monster" | "racer" | "crawler";

export interface CarConfig {
  id: CarTypeId;
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
  axleX: number;       // half-track width
  carBottomOffset: number;
  // ── HUD stat bars (0–100) ─────────────────────────────────────────────────
  statSpeed: number;
  statHandling: number;
  statPower: number;
}

export const CAR_CONFIGS: Record<CarTypeId, CarConfig> = {
  buggy: {
    id: "buggy",
    name: "Dune Buggy",
    description: "Balanced all-rounder built for the desert",
    bodyColorHex: "#c72822",
    maxSpeed: 34, acceleration: 28, brake: 40, steerSpeed: 2.8,
    wheelRadius: 0.52, wheelThickness: 0.30,
    axleY: 0.52, frontAxleZ: 1.32, rearAxleZ: -1.28, axleX: 1.12,
    carBottomOffset: 0.04,
    statSpeed: 75, statHandling: 80, statPower: 70,
  },

  monster: {
    id: "monster",
    name: "Monster Truck",
    description: "Massive wheels, earth-shaking power",
    bodyColorHex: "#1465c0",
    maxSpeed: 24, acceleration: 24, brake: 34, steerSpeed: 1.9,
    wheelRadius: 0.78, wheelThickness: 0.44,
    axleY: 0.78, frontAxleZ: 1.55, rearAxleZ: -1.50, axleX: 1.42,
    carBottomOffset: 0.06,
    statSpeed: 50, statHandling: 45, statPower: 95,
  },

  racer: {
    id: "racer",
    name: "Desert Racer",
    description: "Built for pure speed across open sand",
    bodyColorHex: "#cc8800",
    maxSpeed: 46, acceleration: 38, brake: 52, steerSpeed: 2.3,
    wheelRadius: 0.42, wheelThickness: 0.24,
    axleY: 0.42, frontAxleZ: 1.65, rearAxleZ: -1.58, axleX: 1.08,
    carBottomOffset: 0.03,
    statSpeed: 100, statHandling: 65, statPower: 85,
  },

  crawler: {
    id: "crawler",
    name: "Rock Crawler",
    description: "Slow and steady, grips any terrain",
    bodyColorHex: "#4a6e2a",
    maxSpeed: 18, acceleration: 18, brake: 28, steerSpeed: 3.5,
    wheelRadius: 0.62, wheelThickness: 0.38,
    axleY: 0.62, frontAxleZ: 1.22, rearAxleZ: -1.20, axleX: 1.28,
    carBottomOffset: 0.05,
    statSpeed: 40, statHandling: 95, statPower: 80,
  },
};
