import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 160;

export type TrailKind = "open" | "forest" | "hill" | "rock" | "mud";

export interface TrailSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  kind: TrailKind;
}

const TRAIL_RADIUS: Record<TrailKind, number> = {
  open: 7.0,
  forest: 5.5,
  hill: 8.0,
  rock: 6.0,
  mud: 6.0,
};

export const TRAIL_TREE_BUFFER = 2.0;

// ── Course features ─────────────────────────────────────────────────────────────
export const ENDURO_HILL_X = 38;
export const ENDURO_HILL_Z = 118;
export const ENDURO_HILL_RADIUS = 48;
export const ENDURO_HILL_HEIGHT = 24;

export const ROCK_ZONE_X = -102;
export const ROCK_ZONE_Z = 5;
export const ROCK_ZONE_RADIUS = 38;

export const MUD_ZONE_X = -72;
export const MUD_ZONE_Z = -48;
export const MUD_ZONE_RADIUS = 28;

export const ENDURO_SPAWN = { x: 0, z: -52, heading: Math.PI / 2 };

/** ~1.2 km closed enduro loop through mixed terrain. */
export const ENDURO_LOOP: TrailSegment[] = [
  // Start / finish straight (open)
  { x1: 0, z1: -35, x2: 90, z2: -35, kind: "open" },
  { x1: 90, z1: -35, x2: 130, z2: 0, kind: "open" },
  // Forest twist
  { x1: 130, z1: 0, x2: 150, z2: 50, kind: "forest" },
  { x1: 150, z1: 50, x2: 120, z2: 95, kind: "forest" },
  { x1: 120, z1: 95, x2: 75, z2: 115, kind: "forest" },
  // Hill climb
  { x1: 75, z1: 115, x2: 45, z2: 135, kind: "hill" },
  { x1: 45, z1: 135, x2: 25, z2: 125, kind: "hill" },
  { x1: 25, z1: 125, x2: 15, z2: 105, kind: "hill" },
  // Summit + descent
  { x1: 15, z1: 105, x2: -15, z2: 90, kind: "open" },
  { x1: -15, z1: 90, x2: -70, z2: 60, kind: "open" },
  // Rock garden
  { x1: -70, z1: 60, x2: -110, z2: 10, kind: "rock" },
  { x1: -110, z1: 10, x2: -95, z2: -40, kind: "rock" },
  // Mud bog + return
  { x1: -95, z1: -40, x2: -50, z2: -55, kind: "mud" },
  { x1: -50, z1: -55, x2: 0, z2: -35, kind: "open" },
];

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
  label: string;
}

export const ENDURO_CHECKPOINTS: Checkpoint[] = [
  { x: 45, z: -35, radius: 14, label: "Start Straight" },
  { x: 110, z: -12, radius: 14, label: "Open Sweep" },
  { x: 145, z: 28, radius: 14, label: "Forest Entry" },
  { x: 132, z: 72, radius: 14, label: "Woodland" },
  { x: 92, z: 108, radius: 14, label: "Pre-Climb" },
  { x: 52, z: 132, radius: 14, label: "Hill Climb" },
  { x: 22, z: 118, radius: 14, label: "Summit" },
  { x: -42, z: 78, radius: 14, label: "Descent" },
  { x: -92, z: 38, radius: 14, label: "Rock Approach" },
  { x: -108, z: -8, radius: 14, label: "Rock Garden" },
  { x: -72, z: -48, radius: 14, label: "Mud Bog" },
  { x: 0, z: -35, radius: 16, label: "Finish" },
];

export interface TrailSurfaceInfo {
  dist: number;
  radius: number;
  kind: TrailKind;
}

export function trailSurfaceInfo(x: number, z: number): TrailSurfaceInfo {
  let best: TrailSurfaceInfo = { dist: Infinity, radius: TRAIL_RADIUS.open, kind: "open" };

  for (const t of ENDURO_LOOP) {
    const dist = distToSegment(x, z, t.x1, t.z1, t.x2, t.z2);
    if (dist < best.dist) {
      best = { dist, radius: TRAIL_RADIUS[t.kind], kind: t.kind };
    }
  }

  return best;
}

export function distToTrail(x: number, z: number): number {
  return trailSurfaceInfo(x, z).dist;
}

export function isOnCourse(x: number, z: number, extraRadius = 0): boolean {
  const info = trailSurfaceInfo(x, z);
  return info.dist <= info.radius + extraRadius;
}

export function courseBiome(x: number, z: number): TrailKind {
  const info = trailSurfaceInfo(x, z);
  if (info.dist <= info.radius + 6) return info.kind;
  if (isNearHill(x, z, 8)) return "hill";
  if (isInRockZone(x, z)) return "rock";
  if (isInMudZone(x, z)) return "mud";
  if (x > 95 && z > -25 && z < 115) return "forest";
  return "open";
}

export function isNearHill(x: number, z: number, buffer = 0): boolean {
  return Math.hypot(x - ENDURO_HILL_X, z - ENDURO_HILL_Z) < ENDURO_HILL_RADIUS + buffer;
}

export function isInRockZone(x: number, z: number): boolean {
  return Math.hypot(x - ROCK_ZONE_X, z - ROCK_ZONE_Z) < ROCK_ZONE_RADIUS;
}

export function isInMudZone(x: number, z: number): boolean {
  return Math.hypot(x - MUD_ZONE_X, z - MUD_ZONE_Z) < MUD_ZONE_RADIUS;
}

function hillHeight(x: number, z: number): number {
  const dist = Math.hypot(x - ENDURO_HILL_X, z - ENDURO_HILL_Z);
  if (dist >= ENDURO_HILL_RADIUS) return 0;
  const t = 1 - dist / ENDURO_HILL_RADIUS;
  return t * t * ENDURO_HILL_HEIGHT;
}

function rockRoughness(x: number, z: number): number {
  if (!isInRockZone(x, z)) return 0;
  const dist = Math.hypot(x - ROCK_ZONE_X, z - ROCK_ZONE_Z);
  const falloff = 1 - dist / ROCK_ZONE_RADIUS;
  return (
    (valueNoise(x * 0.5, z * 0.5) - 0.5) * 2.2 +
    (valueNoise(x * 1.2, z * 1.2) - 0.5) * 0.9
  ) * falloff;
}

function mudDip(x: number, z: number): number {
  if (!isInMudZone(x, z)) return 0;
  const dist = Math.hypot(x - MUD_ZONE_X, z - MUD_ZONE_Z);
  const t = 1 - dist / MUD_ZONE_RADIUS;
  return -t * t * 1.4;
}

export function terrainHeight(x: number, z: number): number {
  const base =
    (fbm(x * 0.03, z * 0.028) - 0.5) * 6 +
    Math.sin(x * 0.09 + 0.8) * 0.7 +
    Math.sin(z * 0.08 - 0.4) * 0.5;

  const trail = trailSurfaceInfo(x, z);
  let height = base + hillHeight(x, z) + rockRoughness(x, z) + mudDip(x, z);

  if (trail.dist < trail.radius) {
    const t = 1 - trail.dist / trail.radius;
    height -= t * 0.1;
  }

  return height;
}

const NORMAL_SAMPLE = 1.0;

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const heightLeft = terrainHeight(x - NORMAL_SAMPLE, z);
  const heightRight = terrainHeight(x + NORMAL_SAMPLE, z);
  const heightBack = terrainHeight(x, z - NORMAL_SAMPLE);
  const heightFront = terrainHeight(x, z + NORMAL_SAMPLE);

  out.set(heightLeft - heightRight, NORMAL_SAMPLE * 2, heightBack - heightFront);
  out.normalize();
  return out;
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
