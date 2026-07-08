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

export function configureForestAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.45, 0.62, 0.78, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.55, 0.72, 0.58);
  scene.fogStart = 200;
  scene.fogEnd = 480;
}

export function configureEnduroAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.58, 0.68, 0.82, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.72, 0.68, 0.58);
  scene.fogStart = 220;
  scene.fogEnd = 520;
}

export function configureQuarryAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.48, 0.52, 0.56, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.58, 0.61, 0.64);
  scene.fogStart = 160;
  scene.fogEnd = 420;
}

export function configureDriftAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.72, 0.82, 0.94, 1);

  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.82, 0.86, 0.92);
  scene.fogStart = 300;
  scene.fogEnd = 650;
}

/** @deprecated Use configureDesertAtmosphere */
export const configureSceneAtmosphere = configureDesertAtmosphere;

export function getSunDirection(): Vector3 {
  return new Vector3(-0.55, -1, 0.35).normalize();
}

export const HEMI_INTENSITY = 0.62;
export const SUN_INTENSITY = 1.25;
