import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 160;

/** Half-width of each trail (full width ≈ 11 m — fits the monster truck). */
export const TRAIL_RADIUS = 5.5;

/** Extra clearance beyond trail edge where trees are not placed. */
export const TRAIL_TREE_BUFFER = 2.0;

// ── Forest Hill ───────────────────────────────────────────────────────────────
// A wide climbable mound in the southeast with a marked switchback track.
export const FOREST_HILL_X      = 125;
export const FOREST_HILL_Z      = 125;
export const FOREST_HILL_RADIUS = 58;
export const FOREST_HILL_HEIGHT = 26;

/** Wider path on the hill so the climb is easy to follow. */
export const HILL_TRAIL_RADIUS = 8.0;

/** Returns the extra height contributed by the forest hill at (x, z). */
export function forestHillHeight(x: number, z: number): number {
  const dx = x - FOREST_HILL_X;
  const dz = z - FOREST_HILL_Z;
  const dist = Math.hypot(dx, dz);
  if (dist >= FOREST_HILL_RADIUS) return 0;
  const t = 1.0 - dist / FOREST_HILL_RADIUS;
  return t * t * FOREST_HILL_HEIGHT;
}

export function isNearForestHill(x: number, z: number, buffer = 0): boolean {
  const dx = x - FOREST_HILL_X;
  const dz = z - FOREST_HILL_Z;
  return Math.hypot(dx, dz) < FOREST_HILL_RADIUS + buffer;
}

export interface TrailSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** Connected trail network through the forest. */
export const FOREST_TRAILS: TrailSegment[] = [
  // Main cross through spawn
  { x1: -200, z1: 0,   x2: 200,  z2: 0   },
  { x1: 0,    z1: -200, x2: 0,    z2: 200  },
  // Inner square loop
  { x1: -100, z1: -100, x2: 100,  z2: -100 },
  { x1: 100,  z1: -100, x2: 100,  z2: 100  },
  { x1: 100,  z1: 100,  x2: -100, z2: 100  },
  { x1: -100, z1: 100,  x2: -100, z2: -100 },
  // Spokes to outer ring
  { x1: -100, z1: 0,    x2: -165, z2: 0   },
  { x1: 100,  z1: 0,    x2: 165,  z2: 0   },
  { x1: 0,    z1: -100, x2: 0,    z2: -165 },
  { x1: 0,    z1: 100,  x2: 0,    z2: 165  },
  // Outer partial ring
  { x1: -165, z1: -90,  x2: -165, z2: 90  },
  { x1: 165,  z1: -90,  x2: 165,  z2: 90  },
  { x1: -90,  z1: -165, x2: 90,   z2: -165 },
  { x1: -90,  z1: 165,  x2: 90,   z2: 165  },
  // Diagonal shortcuts
  { x1: -100, z1: -100, x2: -165, z2: -165 },
  { x1: 100,  z1: -100, x2: 165,  z2: -165 },
  { x1: 100,  z1: 100,  x2: 165,  z2: 165  },
  { x1: -100, z1: 100,  x2: -165, z2: 165  },
];

/** Light-brown switchback that winds up the wide hill. */
export const HILL_TRAILS: TrailSegment[] = [
  { x1: 100, z1: 100, x2: 108, z2: 114 },
  { x1: 108, z1: 114, x2: 116, z2: 126 },
  { x1: 116, z1: 126, x2: 125, z2: 125 },
  { x1: 125, z1: 125, x2: 138, z2: 136 },
  { x1: 138, z1: 136, x2: 155, z2: 152 },
  { x1: 155, z1: 152, x2: 168, z2: 162 },
];

export interface TrailSurfaceInfo {
  dist: number;
  radius: number;
  isHillTrail: boolean;
}

export function trailSurfaceInfo(x: number, z: number): TrailSurfaceInfo {
  let best: TrailSurfaceInfo = { dist: Infinity, radius: TRAIL_RADIUS, isHillTrail: false };

  for (const t of FOREST_TRAILS) {
    const dist = distToSegment(x, z, t.x1, t.z1, t.x2, t.z2);
    if (dist < best.dist) {
      best = { dist, radius: TRAIL_RADIUS, isHillTrail: false };
    }
  }

  for (const t of HILL_TRAILS) {
    const dist = distToSegment(x, z, t.x1, t.z1, t.x2, t.z2);
    if (dist < best.dist) {
      best = { dist, radius: HILL_TRAIL_RADIUS, isHillTrail: true };
    }
  }

  return best;
}

export function distToTrail(x: number, z: number): number {
  return trailSurfaceInfo(x, z).dist;
}

export function isOnTrail(x: number, z: number, extraRadius = 0): boolean {
  const info = trailSurfaceInfo(x, z);
  return info.dist <= info.radius + extraRadius;
}

export function terrainHeight(x: number, z: number): number {
  const base =
    (fbm(x * 0.035, z * 0.03) - 0.5) * 5 +
    Math.sin(x * 0.12 + 1.1) * 0.8 +
    Math.sin(z * 0.1 - 0.6) * 0.6;

  const trail = trailSurfaceInfo(x, z);
  if (trail.dist < trail.radius) {
    const t = 1 - trail.dist / trail.radius;
    return base - t * 0.12 + forestHillHeight(x, z);
  }
  return base + forestHillHeight(x, z);
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
  const cx = x1 + t * dx;
  const cz = z1 + t * dz;
  return Math.hypot(px - cx, pz - cz);
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
  const n00 = hash(x0, z0);
  const n10 = hash(x1, z0);
  const n01 = hash(x0, z1);
  const n11 = hash(x1, z1);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sz);
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
