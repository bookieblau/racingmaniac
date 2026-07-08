import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 140;

export const DRIFT_SPAWN = { x: 0, z: 0, heading: 0 };

export interface JumpRamp {
  cx: number;
  cz: number;
  /** Takeoff direction — vehicle launches toward this heading. */
  heading: number;
  width: number;
  approach: number;
  lip: number;
  landing: number;
  height: number;
}

/** Ramps spread across the open flat arena. */
export const DRIFT_RAMPS: JumpRamp[] = [
  { cx: 0,    cz: -70,  heading: 0,              width: 24, approach: 16, lip: 4, landing: 22, height: 4.8 },
  { cx: 110,  cz: 30,   heading: Math.PI * 0.72, width: 22, approach: 14, lip: 3, landing: 20, height: 4.0 },
  { cx: -115, cz: 90,   heading: -Math.PI / 2,   width: 22, approach: 14, lip: 3, landing: 22, height: 5.0 },
  { cx: 130,  cz: -110, heading: Math.PI,        width: 20, approach: 12, lip: 3, landing: 18, height: 3.6 },
  { cx: -70,  cz: -130, heading: Math.PI * 0.28, width: 24, approach: 16, lip: 4, landing: 24, height: 5.5 },
];

export function terrainHeight(x: number, z: number): number {
  let maxH = 0;
  for (const ramp of DRIFT_RAMPS) {
    maxH = Math.max(maxH, rampHeight(x, z, ramp));
  }
  return maxH;
}

const NORMAL_SAMPLE = 0.8;

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const heightLeft = terrainHeight(x - NORMAL_SAMPLE, z);
  const heightRight = terrainHeight(x + NORMAL_SAMPLE, z);
  const heightBack = terrainHeight(x, z - NORMAL_SAMPLE);
  const heightFront = terrainHeight(x, z + NORMAL_SAMPLE);

  out.set(heightLeft - heightRight, NORMAL_SAMPLE * 2, heightBack - heightFront);
  out.normalize();
  return out;
}

function rampHeight(x: number, z: number, ramp: JumpRamp): number {
  const sin = Math.sin(ramp.heading);
  const cos = Math.cos(ramp.heading);
  const lx = (x - ramp.cx) * cos - (z - ramp.cz) * sin;
  const ly = (x - ramp.cx) * sin + (z - ramp.cz) * cos;

  if (Math.abs(ly) > ramp.width / 2) return 0;

  const start = -ramp.approach;
  const end = ramp.landing;

  if (lx < start || lx > end) return 0;

  // Crest at lx = 0 — sharpen the lip so the last part of the climb kicks upward.
  if (lx < 0) {
    const t = (lx - start) / (-start);
    const eased = smoothstep(t);
    const kick = t > 0.82 ? ((t - 0.82) / 0.18) * 0.12 : 0;
    return Math.min(ramp.height * 1.08, (eased + kick) * ramp.height);
  }

  // Immediate downslope after the lip.
  const t = lx / ramp.landing;
  return ramp.height * (1 - smoothstep(t));
}

export interface RampLaunch {
  strength: number;
  height: number;
}

function toRampLocal(x: number, z: number, ramp: JumpRamp): { lx: number; ly: number } {
  const sin = Math.sin(ramp.heading);
  const cos = Math.cos(ramp.heading);
  return {
    lx: (x - ramp.cx) * cos - (z - ramp.cz) * sin,
    ly: (x - ramp.cx) * sin + (z - ramp.cz) * cos,
  };
}

/** Car heading that drives up the ramp (+lx axis). */
function rampApproachHeading(ramp: JumpRamp): number {
  return Math.atan2(Math.cos(ramp.heading), -Math.sin(ramp.heading));
}

/**
 * Detect the frame the front axle crosses the crest (top of upslope, lx = 0).
 * Uses approach heading — not takeoff heading — so alignment matches how you drive on.
 */
export function rampCrestLaunch(
  x: number,
  z: number,
  prevX: number,
  prevZ: number,
  travelHeading: number,
  bodyHeading: number,
  speed: number,
  frontAxleOffset: number,
): RampLaunch | null {
  if (speed < CAR_LIFTOFF_MIN_SPEED) return null;

  const sinB = Math.sin(bodyHeading);
  const cosB = Math.cos(bodyHeading);
  const fx = x + sinB * frontAxleOffset;
  const fz = z + cosB * frontAxleOffset;
  const pfx = prevX + sinB * frontAxleOffset;
  const pfz = prevZ + cosB * frontAxleOffset;

  let best: RampLaunch | null = null;

  for (const ramp of DRIFT_RAMPS) {
    const cur = toRampLocal(fx, fz, ramp);
    const prev = toRampLocal(pfx, pfz, ramp);

    if (Math.abs(cur.ly) > ramp.width / 2 - 1) continue;

    const approachH = rampApproachHeading(ramp);
    if (Math.abs(normalizeAngle(travelHeading - approachH)) > 0.75) continue;

    // Front wheels crossed the lip — tolerate fast frames that skip lx = 0 exactly.
    const crossedCrest =
      prev.lx < 0.35 &&
      cur.lx >= -0.25 &&
      cur.lx < 3.5 &&
      cur.lx > prev.lx + 0.02;
    if (!crossedCrest) continue;

    const h = rampHeight(fx, fz, ramp);
    if (h < ramp.height * 0.88) continue;

    const strength = Math.min(1, 0.55 + (speed - CAR_LIFTOFF_MIN_SPEED) / 18);
    if (!best || strength > best.strength) {
      best = { strength, height: ramp.height };
    }
  }

  return best;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** @deprecated Use rampCrestLaunch — kept so older callers compile. */
export function rampTakeoffStrength(
  x: number,
  z: number,
  heading: number,
  speed: number,
): number {
  const launch = rampCrestLaunch(x, z, x, z, heading, heading, speed, 0);
  return launch?.strength ?? 0;
}

const CAR_LIFTOFF_MIN_SPEED = 4.5;

function normalizeAngle(a: number): number {
  let n = a;
  while (n > Math.PI) n -= 2 * Math.PI;
  while (n < -Math.PI) n += 2 * Math.PI;
  return n;
}
