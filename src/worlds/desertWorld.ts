import { Color3, Scene } from "@babylonjs/core";
import { configureDesertAtmosphere } from "../lighting";
import { createDesertSky } from "../sky";
import { createDesertTerrain } from "../terrainMesh";
import { populateWorld } from "../world";

export function setupDesertWorld(scene: Scene): void {
  configureDesertAtmosphere(scene);
  createDesertSky(scene);
  createDesertTerrain(scene);
  populateWorld(scene);
}

export const DESERT_HEMI_GROUND = new Color3(0.55, 0.42, 0.24);
export const DESERT_HEMI_DIFFUSE = new Color3(0.92, 0.88, 0.82);
export const DESERT_SUN_DIFFUSE = new Color3(1, 0.94, 0.78);
export const DESERT_SUN_SPECULAR = new Color3(0.9, 0.85, 0.7);
