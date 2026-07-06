import { Vector3 } from "@babylonjs/core";

/**
 * Y-level of the backing plane used only for mesas and the far-ground mesh.
 * Set well below the theoretical terrain minimum (≈ -28) so no flat fill
 * appears within the playable area — valleys keep their natural shape.
 */
export const DESERT_FLOOR = -32;

/**
 * Procedural desert height at world (x, z).
 * Layered noise: tall slow dunes, medium rolls, small ripples.
 * No floor clamp — full natural relief retained.
 */
export function terrainHeight(x: number, z: number): number {
  const largeDunes = (fbm(x * 0.02, z * 0.017) - 0.5) * 30;
  const mediumDunes = (fbm(x * 0.055 + 12, z * 0.05 + 8) - 0.5) * 12;
  const ridge = Math.sin(x * 0.038 + z * 0.031 + 1.4) * Math.cos(x * 0.022 - z * 0.027) * 5;
  const ripples =
    Math.sin(x * 0.16 + z * 0.13) * 1.1 + Math.sin(x * 0.24 - z * 0.19) * 0.55;

  return largeDunes + mediumDunes + ridge + ripples;
}

const NORMAL_SAMPLE = 1.1;

/** Approximate ground normal for slope tilt and lighting. */
export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const heightLeft = terrainHeight(x - NORMAL_SAMPLE, z);
  const heightRight = terrainHeight(x + NORMAL_SAMPLE, z);
  const heightBack = terrainHeight(x, z - NORMAL_SAMPLE);
  const heightFront = terrainHeight(x, z + NORMAL_SAMPLE);

  out.set(heightLeft - heightRight, NORMAL_SAMPLE * 2, heightBack - heightFront);
  out.normalize();
  return out;
}

function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.05, z * 2.05) * 0.25 +
    valueNoise(x * 4.2, z * 4.2) * 0.12 +
    valueNoise(x * 8.4, z * 8.4) * 0.08
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

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sz);
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

export const TERRAIN_SIZE = 220;
export const TERRAIN_SUBDIVISIONS = 128;
