import { Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { WorldId } from "./worldTypes";
import * as desertTerrain from "./terrain";
import * as cityTerrain from "./cityTerrain";
import { setupDesertWorld } from "./worlds/desertWorld";
import { setupCityWorld } from "./worlds/cityWorld";

export interface TerrainAPI {
  terrainHeight: (x: number, z: number) => number;
  terrainNormal: (x: number, z: number, out?: Vector3) => Vector3;
  terrainSize: number;
  terrainSubdivisions: number;
}

let activeTerrain: TerrainAPI = {
  terrainHeight: desertTerrain.terrainHeight,
  terrainNormal: desertTerrain.terrainNormal,
  terrainSize: desertTerrain.TERRAIN_SIZE,
  terrainSubdivisions: desertTerrain.TERRAIN_SUBDIVISIONS,
};

let activeWorldId: WorldId = "desert";

export function setActiveWorld(worldId: WorldId): void {
  activeWorldId = worldId;
  if (worldId === "city") {
    activeTerrain = {
      terrainHeight: cityTerrain.terrainHeight,
      terrainNormal: cityTerrain.terrainNormal,
      terrainSize: cityTerrain.TERRAIN_SIZE,
      terrainSubdivisions: cityTerrain.TERRAIN_SUBDIVISIONS,
    };
  } else {
    activeTerrain = {
      terrainHeight: desertTerrain.terrainHeight,
      terrainNormal: desertTerrain.terrainNormal,
      terrainSize: desertTerrain.TERRAIN_SIZE,
      terrainSubdivisions: desertTerrain.TERRAIN_SUBDIVISIONS,
    };
  }
}

export function getActiveWorldId(): WorldId {
  return activeWorldId;
}

export function terrainHeight(x: number, z: number): number {
  return activeTerrain.terrainHeight(x, z);
}

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  return activeTerrain.terrainNormal(x, z, out);
}

export function getTerrainSize(): number {
  return activeTerrain.terrainSize;
}

export function getTerrainSubdivisions(): number {
  return activeTerrain.terrainSubdivisions;
}

export function buildWorld(scene: Scene): void {
  if (activeWorldId === "city") {
    setupCityWorld(scene);
  } else {
    setupDesertWorld(scene);
  }
}

/** Default spawn point per world (centre of a clear road intersection in the city). */
export function getSpawnState(): { x: number; z: number; heading: number } {
  if (activeWorldId === "city") {
    return { x: -25, z: -25, heading: 0 };
  }
  return { x: 0, z: 0, heading: 0 };
}
