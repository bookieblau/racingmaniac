import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 180;

export type TrailKind = "haul" | "single" | "climb" | "stream" | "rock";

export interface TrailSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  kind: TrailKind;
}

const TRAIL_RADIUS: Record<TrailKind, number> = {
  haul: 6.0,
  single: 3.5,
  climb: 4.5,
  stream: 4.0,
  rock: 4.0,
};

export const OBSTACLE_BUFFER = 1.6;

// ── Quarry bowl (disused stone pit) ───────────────────────────────────────────
export const BOWL_CENTER_X = 0;
export const BOWL_CENTER_Z = 22;
export const BOWL_RIM_RADIUS = 95;
export const BOWL_DEPTH = 18;
export const BOWL_TERRACES = 6;

// ── Extreme climbs (Wern Ddu-style quarry faces) ────────────────────────────────
export const NORTH_CLIMB_X = 12;
export const NORTH_CLIMB_Z = 96;
export const NORTH_CLIMB_RADIUS = 30;
export const NORTH_CLIMB_HEIGHT = 26;

export const EAST_CLIMB_X = 72;
export const EAST_CLIMB_Z = 18;
export const EAST_CLIMB_RADIUS = 24;
export const EAST_CLIMB_HEIGHT = 20;

// ── Rocky stream gully ────────────────────────────────────────────────────────
export const STREAM_X1 = -48;
export const STREAM_Z1 = 48;
export const STREAM_X2 = 18;
export const STREAM_Z2 = 28;
export const STREAM_WIDTH = 10;

export const ROCK_GARDEN_X = -68;
export const ROCK_GARDEN_Z = 18;
export const ROCK_GARDEN_RADIUS = 32;

export const QUARRY_SPAWN = { x: 0, z: -168, heading: 0 };

/**
 * Marked hard-enduro lap inspired by Wern Ddu Quarry layout:
 * haul road in → bowl floor → rocky stream → single track → extreme climb →
 * rim road → rock garden → finish.
 */
export const QUARRY_COURSE: TrailSegment[] = [
  // Entrance haul road
  { x1: 0, z1: -155, x2: 0, z2: -118, kind: "haul" },
  { x1: 0, z1: -118, x2: 42, z2: -88, kind: "haul" },
  { x1: 42, z1: -88, x2: 78, z2: -58, kind: "haul" },
  // Drop into quarry bowl
  { x1: 78, z1: -58, x2: 58, z2: -18, kind: "haul" },
  { x1: 58, z1: -18, x2: 22, z2: 8, kind: "haul" },
  // Rocky stream bed
  { x1: 22, z1: 8, x2: -8, z2: 32, kind: "stream" },
  { x1: -8, z1: 32, x2: -38, z2: 52, kind: "stream" },
  // Narrow single track along east wall
  { x1: -38, z1: 52, x2: -12, z2: 78, kind: "single" },
  { x1: -12, z1: 78, x2: 8, z2: 92, kind: "single" },
  // Extreme north-face climb
  { x1: 8, z1: 92, x2: 18, z2: 104, kind: "climb" },
  { x1: 18, z1: 104, x2: 32, z2: 112, kind: "climb" },
  // West rim haul road
  { x1: 32, z1: 112, x2: 0, z2: 122, kind: "haul" },
  { x1: 0, z1: 122, x2: -48, z2: 108, kind: "haul" },
  { x1: -48, z1: 108, x2: -78, z2: 68, kind: "haul" },
  // Technical rock garden descent
  { x1: -78, z1: 68, x2: -72, z2: 28, kind: "rock" },
  { x1: -72, z1: 28, x2: -48, z2: -8, kind: "rock" },
  { x1: -48, z1: -8, x2: -22, z2: -48, kind: "rock" },
  // Return along bowl edge to finish
  { x1: -22, z1: -48, x2: 0, z2: -88, kind: "haul" },
  { x1: 0, z1: -88, x2: 0, z2: -155, kind: "haul" },
];

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
  label: string;
}

export const QUARRY_CHECKPOINTS: Checkpoint[] = [
  { x: 0, z: -140, radius: 12, label: "Entrance" },
  { x: 22, z: -105, radius: 12, label: "Haul Road" },
  { x: 62, z: -72, radius: 12, label: "East Rim" },
  { x: 48, z: -32, radius: 12, label: "Bowl Entry" },
  { x: 18, z: 2, radius: 12, label: "Bowl Floor" },
  { x: -5, z: 30, radius: 11, label: "Stream Entry" },
  { x: -32, z: 50, radius: 11, label: "Rocky Stream" },
  { x: -10, z: 76, radius: 11, label: "Single Track" },
  { x: 10, z: 94, radius: 11, label: "Climb Base" },
  { x: 28, z: 110, radius: 11, label: "Summit" },
  { x: -42, z: 106, radius: 12, label: "West Rim" },
  { x: -74, z: 58, radius: 11, label: "Technical" },
  { x: -58, z: 8, radius: 11, label: "Rock Garden" },
  { x: 0, z: -155, radius: 14, label: "Finish" },
];

export interface TrailSurfaceInfo {
  dist: number;
  radius: number;
  kind: TrailKind;
}

export function trailSurfaceInfo(x: number, z: number): TrailSurfaceInfo {
  let best: TrailSurfaceInfo = { dist: Infinity, radius: TRAIL_RADIUS.haul, kind: "haul" };

  for (const t of QUARRY_COURSE) {
    const dist = distToSegment(x, z, t.x1, t.z1, t.x2, t.z2);
    if (dist < best.dist) {
      best = { dist, radius: TRAIL_RADIUS[t.kind], kind: t.kind };
    }
  }

  return best;
}

export function isOnCourse(x: number, z: number, extraRadius = 0): boolean {
  const info = trailSurfaceInfo(x, z);
  return info.dist <= info.radius + extraRadius;
}

export function isInBowl(x: number, z: number, buffer = 0): boolean {
  return Math.hypot(x - BOWL_CENTER_X, z - BOWL_CENTER_Z) < BOWL_RIM_RADIUS + buffer;
}

export function isInRockGarden(x: number, z: number): boolean {
  return Math.hypot(x - ROCK_GARDEN_X, z - ROCK_GARDEN_Z) < ROCK_GARDEN_RADIUS;
}

export function isNearStream(x: number, z: number, extra = 0): boolean {
  return distToSegment(x, z, STREAM_X1, STREAM_Z1, STREAM_X2, STREAM_Z2) < STREAM_WIDTH + extra;
}

export function terrainHeight(x: number, z: number): number {
  const rim =
    (fbm(x * 0.025, z * 0.022) - 0.5) * 4 +
    Math.sin(x * 0.07 + 0.5) * 0.5;

  let height =
    rim +
    quarryBowl(x, z) +
    northClimb(x, z) +
    eastClimb(x, z) +
    streamChannel(x, z) +
    rockRoughness(x, z);

  const trail = trailSurfaceInfo(x, z);
  if (trail.dist < trail.radius) {
    height -= (1 - trail.dist / trail.radius) * 0.08;
  }

  return height;
}

const NORMAL_SAMPLE = 0.9;

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const heightLeft = terrainHeight(x - NORMAL_SAMPLE, z);
  const heightRight = terrainHeight(x + NORMAL_SAMPLE, z);
  const heightBack = terrainHeight(x, z - NORMAL_SAMPLE);
  const heightFront = terrainHeight(x, z + NORMAL_SAMPLE);

  out.set(heightLeft - heightRight, NORMAL_SAMPLE * 2, heightBack - heightFront);
  out.normalize();
  return out;
}

function quarryBowl(x: number, z: number): number {
  const dist = Math.hypot(x - BOWL_CENTER_X, z - BOWL_CENTER_Z);
  if (dist >= BOWL_RIM_RADIUS) return 0;

  const t = 1 - dist / BOWL_RIM_RADIUS;
  const terrace = Math.floor(t * BOWL_TERRACES) / BOWL_TERRACES;
  const smooth = terrace * BOWL_DEPTH;
  const innerBowl = t * t * (BOWL_DEPTH * 0.35);
  return -(smooth + innerBowl);
}

function northClimb(x: number, z: number): number {
  const dist = Math.hypot(x - NORTH_CLIMB_X, z - NORTH_CLIMB_Z);
  if (dist >= NORTH_CLIMB_RADIUS) return 0;
  const t = 1 - dist / NORTH_CLIMB_RADIUS;
  return t * t * NORTH_CLIMB_HEIGHT;
}

function eastClimb(x: number, z: number): number {
  const dist = Math.hypot(x - EAST_CLIMB_X, z - EAST_CLIMB_Z);
  if (dist >= EAST_CLIMB_RADIUS) return 0;
  const t = 1 - dist / EAST_CLIMB_RADIUS;
  return t * t * EAST_CLIMB_HEIGHT;
}

function streamChannel(x: number, z: number): number {
  const dist = distToSegment(x, z, STREAM_X1, STREAM_Z1, STREAM_X2, STREAM_Z2);
  if (dist >= STREAM_WIDTH) return 0;
  const t = 1 - dist / STREAM_WIDTH;
  return -t * t * 2.8 + (valueNoise(x * 0.8, z * 0.8) - 0.5) * 0.6 * t;
}

function rockRoughness(x: number, z: number): number {
  let rough = 0;

  if (isInRockGarden(x, z)) {
    const dist = Math.hypot(x - ROCK_GARDEN_X, z - ROCK_GARDEN_Z);
    const falloff = 1 - dist / ROCK_GARDEN_RADIUS;
    rough += ((valueNoise(x * 0.6, z * 0.6) - 0.5) * 2.4 + (valueNoise(x * 1.4, z * 1.4) - 0.5)) * falloff;
  }

  if (isNearStream(x, z, 4)) {
    const t = 1 - distToSegment(x, z, STREAM_X1, STREAM_Z1, STREAM_X2, STREAM_Z2) / (STREAM_WIDTH + 4);
    rough += (valueNoise(x * 1.1, z * 1.1) - 0.5) * 1.2 * t;
  }

  if (isInBowl(x, z, -8) && !isOnCourse(x, z, 2)) {
    rough += (valueNoise(x * 0.45, z * 0.45) - 0.5) * 1.0;
  }

  return rough;
}

function distToSegment(
  px: number, pz: number,
  x1: number, z1: number,
  x2: number, z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  if (len2 < 0.001) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / len2));
  return Math.hypot(px - x1 - t * dx, pz - z1 - t * dz);
}

function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.1, z * 2.1) * 0.25 +
    valueNoise(x * 4.3, z * 4.3) * 0.12 +
    valueNoise(x * 8.6, z * 8.6) * 0.08
  );
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const sx = smoothstep(x - x0);
  const sz = smoothstep(z - z0);
  return lerp(
    lerp(hash(x0, z0), hash(x1, z0), sx),
    lerp(hash(x0, z1), hash(x1, z1), sx),
    sz,
  );
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
