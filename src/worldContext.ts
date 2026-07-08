import { Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { ObstacleField } from "./obstacles";
import * as desertTerrain from "./terrain";
import * as forestTerrain from "./forestTerrain";
import * as enduroTerrain from "./enduroTerrain";
import * as quarryTerrain from "./quarryTerrain";
import * as driftTerrain from "./driftTerrain";
import { setupDesertWorld } from "./worlds/desertWorld";
import { setupForestWorld } from "./worlds/forestWorld";
import { setupEnduroWorld } from "./worlds/enduroWorld";
import { setupQuarryWorld } from "./worlds/quarryWorld";
import { setupDriftWorld } from "./worlds/driftWorld";
import type { WorldId } from "./worldTypes";

let activeWorld: WorldId = "desert";
let obstacles = ObstacleField.empty();

export function getActiveWorld(): WorldId {
  return activeWorld;
}

export function isRaceWorld(worldId: WorldId): boolean {
  return worldId === "enduro" || worldId === "quarry";
}

export function isBikesOnlyWorld(worldId: WorldId): boolean {
  return worldId === "quarry";
}

export function isDriftWorld(worldId?: WorldId): boolean {
  return (worldId ?? activeWorld) === "drift";
}

export function getSurfaceGripMult(): number {
  return activeWorld === "drift" ? 0.55 : 1.0;
}

export function buildWorld(scene: Scene, worldId: WorldId): void {
  activeWorld = worldId;
  obstacles = ObstacleField.empty();

  switch (worldId) {
    case "forest":
      obstacles = setupForestWorld(scene);
      break;
    case "enduro":
      obstacles = setupEnduroWorld(scene);
      break;
    case "quarry":
      obstacles = setupQuarryWorld(scene);
      break;
    case "drift":
      setupDriftWorld(scene);
      break;
    default:
      setupDesertWorld(scene);
  }
}

export function getSpawnState(worldId: WorldId): { x: number; z: number; heading: number } | undefined {
  if (worldId === "enduro") return enduroTerrain.ENDURO_SPAWN;
  if (worldId === "quarry") return quarryTerrain.QUARRY_SPAWN;
  if (worldId === "drift") return driftTerrain.DRIFT_SPAWN;
  return undefined;
}

export function getRaceCheckpoints(worldId: WorldId) {
  if (worldId === "enduro") return enduroTerrain.ENDURO_CHECKPOINTS;
  if (worldId === "quarry") return quarryTerrain.QUARRY_CHECKPOINTS;
  return null;
}

export function getRampCrestLaunch(
  x: number,
  z: number,
  prevX: number,
  prevZ: number,
  travelHeading: number,
  bodyHeading: number,
  speed: number,
  frontAxleOffset: number,
): { strength: number; height: number } | null {
  if (activeWorld !== "drift") return null;
  return driftTerrain.rampCrestLaunch(
    x, z, prevX, prevZ, travelHeading, bodyHeading, speed, frontAxleOffset,
  );
}

export function getRampTakeoffStrength(
  x: number,
  z: number,
  heading: number,
  speed: number,
): number {
  if (activeWorld !== "drift") return 0;
  return driftTerrain.rampTakeoffStrength(x, z, heading, speed);
}

export function getObstacles(): ObstacleField {
  return obstacles;
}

export const TERRAIN_SIZE = desertTerrain.TERRAIN_SIZE;

export function terrainHeight(x: number, z: number): number {
  switch (activeWorld) {
    case "drift": return driftTerrain.terrainHeight(x, z);
    case "quarry": return quarryTerrain.terrainHeight(x, z);
    case "enduro": return enduroTerrain.terrainHeight(x, z);
    case "forest": return forestTerrain.terrainHeight(x, z);
    default: return desertTerrain.terrainHeight(x, z);
  }
}

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  switch (activeWorld) {
    case "drift": return driftTerrain.terrainNormal(x, z, out);
    case "quarry": return quarryTerrain.terrainNormal(x, z, out);
    case "enduro": return enduroTerrain.terrainNormal(x, z, out);
    case "forest": return forestTerrain.terrainNormal(x, z, out);
    default: return desertTerrain.terrainNormal(x, z, out);
  }
}
