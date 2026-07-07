import { Vector3 } from "@babylonjs/core";

export const TERRAIN_SIZE = 440;
export const TERRAIN_SUBDIVISIONS = 128;

/** City block size (building lot + shared road width). */
export const CITY_BLOCK = 38;
/** Width of each road strip along block edges. */
export const CITY_ROAD = 10;

/** Flat city ground — road markings are visual only (texture), not height steps. */
export function terrainHeight(_x: number, _z: number): number {
  return 0;
}

const NORMAL_SAMPLE = 1.0;

export function terrainNormal(_x: number, _z: number, out = new Vector3()): Vector3 {
  out.set(0, 1, 0);
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
