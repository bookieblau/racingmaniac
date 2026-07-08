import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import { ObstacleField } from "../obstacles";
import { DRIFT_RAMPS, terrainHeight } from "../driftTerrain";
import { configureDriftAtmosphere } from "../lighting";
import { createDriftSky } from "../driftSky";
import { createDriftTerrain } from "../driftTerrainMesh";

export function setupDriftWorld(scene: Scene): ObstacleField {
  configureDriftAtmosphere(scene);
  createDriftSky(scene);
  createDriftTerrain(scene);
  placeJumpMarkers(scene);
  placeArenaBoundary(scene);
  return ObstacleField.empty();
}

export const DRIFT_HEMI_GROUND = new Color3(0.32, 0.32, 0.30);
export const DRIFT_HEMI_DIFFUSE = new Color3(0.88, 0.88, 0.86);
export const DRIFT_SUN_DIFFUSE = new Color3(1, 0.98, 0.92);
export const DRIFT_SUN_SPECULAR = new Color3(0.85, 0.85, 0.82);

function placeJumpMarkers(scene: Scene): void {
  const coneMat = new StandardMaterial("driftCone", scene);
  coneMat.diffuseColor = new Color3(0.92, 0.42, 0.08);
  coneMat.specularColor = new Color3(0.1, 0.05, 0.02);

  for (let i = 0; i < DRIFT_RAMPS.length; i++) {
    const ramp = DRIFT_RAMPS[i]!;
    const sin = Math.sin(ramp.heading);
    const cos = Math.cos(ramp.heading);

    // Cones flanking the jump approach
    for (const side of [-1, 1]) {
      const lx = -ramp.approach * 0.55;
      const ly = side * (ramp.width / 2 + 2.5);
      const x = ramp.cx + lx * cos - ly * sin;
      const z = ramp.cz + lx * sin + ly * cos;
      const y = terrainHeight(x, z);

      const cone = MeshBuilder.CreateCylinder(
        `driftCone${i}_${side}`,
        { diameterTop: 0.05, diameterBottom: 0.9, height: 1.1, tessellation: 10 },
        scene,
      );
      cone.position.set(x, y + 0.55, z);
      cone.material = coneMat;
      cone.isPickable = false;
    }
  }
}

function placeArenaBoundary(scene: Scene): void {
  const postMat = new StandardMaterial("driftBoundary", scene);
  postMat.diffuseColor = new Color3(0.75, 0.75, 0.78);
  postMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const limit = 200;
  const spacing = 40;
  let idx = 0;

  for (let x = -limit; x <= limit; x += spacing) {
    for (const z of [-limit, limit]) {
      placePost(scene, x, z, postMat, idx++);
    }
  }
  for (let z = -limit + spacing; z < limit; z += spacing) {
    for (const x of [-limit, limit]) {
      placePost(scene, x, z, postMat, idx++);
    }
  }
}

function placePost(
  scene: Scene,
  x: number,
  z: number,
  mat: StandardMaterial,
  idx: number,
): void {
  const y = terrainHeight(x, z);
  const post = MeshBuilder.CreateCylinder(
    `driftPost${idx}`,
    { diameter: 0.2, height: 2.4, tessellation: 6 },
    scene,
  );
  post.position.set(x, y + 1.2, z);
  post.material = mat;
  post.isPickable = false;
}
