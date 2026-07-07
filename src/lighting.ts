import { Color3, Scene, Vector3 } from "@babylonjs/core";

export function configureDesertAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.55, 0.72, 0.95, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.9, 0.78, 0.56);
  scene.fogStart = 260;
  scene.fogEnd = 600;
}

export function configureCityAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.62, 0.70, 0.82, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.75, 0.78, 0.85);
  scene.fogStart = 180;
  scene.fogEnd = 420;
}

/** @deprecated Use configureDesertAtmosphere */
export const configureSceneAtmosphere = configureDesertAtmosphere;

export function getSunDirection(): Vector3 {
  return new Vector3(-0.55, -1, 0.35).normalize();
}

export const HEMI_INTENSITY = 0.62;
export const SUN_INTENSITY = 1.25;
