import { Color3, Scene, Vector3 } from "@babylonjs/core";

export function configureSceneAtmosphere(scene: Scene): void {
  scene.clearColor.set(0.55, 0.72, 0.95, 1);

  // Linear fog keeps the car readable while the horizon still fades out.
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.9, 0.78, 0.56);
  scene.fogStart = 130;
  scene.fogEnd = 300;
}

export function getSunDirection(): Vector3 {
  return new Vector3(-0.55, -1, 0.35).normalize();
}

export const HEMI_INTENSITY = 0.62;
export const SUN_INTENSITY = 1.25;
