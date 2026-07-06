/** Procedural desert height at world (x, z). Shared by mesh and driving. */
export function terrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.07) * 1.4 +
    Math.cos(z * 0.055) * 1.1 +
    Math.sin((x + z) * 0.11) * 0.9 +
    Math.sin(x * 0.18 + 1.3) * Math.cos(z * 0.16) * 0.5
  );
}

export const TERRAIN_SIZE = 220;
export const TERRAIN_SUBDIVISIONS = 96;
