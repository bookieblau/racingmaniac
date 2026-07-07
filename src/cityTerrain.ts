import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 128;

/** City block size (building lot + shared road width). */
export const CITY_BLOCK = 38;
/** Width of each road strip along block edges. */
export const CITY_ROAD = 10;

/**
 * Mostly flat urban ground with subtle drainage ripples.
 * Roads sit at 0; sidewalks are +2 cm; lots are +1 cm.
 */
export function terrainHeight(x: number, z: number): number {
  const ripple =
    Math.sin(x * 0.11 + 1.2) * 0.06 +
    Math.sin(z * 0.09 - 0.8) * 0.05;

  const lx = mod(x + TERRAIN_SIZE / 2, CITY_BLOCK);
  const lz = mod(z + TERRAIN_SIZE / 2, CITY_BLOCK);
  const onRoad = lx < CITY_ROAD || lz < CITY_ROAD;

  const base = onRoad ? 0.0 : 0.01;
  return base + ripple;
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

/** True when (x,z) lies on a road surface. */
export function isOnRoad(x: number, z: number): boolean {
  const lx = mod(x + TERRAIN_SIZE / 2, CITY_BLOCK);
  const lz = mod(z + TERRAIN_SIZE / 2, CITY_BLOCK);
  return lx < CITY_ROAD || lz < CITY_ROAD;
}

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}
