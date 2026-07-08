import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import { CircleObstacle, ObstacleField } from "../obstacles";
import {
  FOREST_HILL_RADIUS,
  FOREST_HILL_X,
  FOREST_HILL_Z,
  TERRAIN_SIZE,
  TRAIL_TREE_BUFFER,
  isNearForestHill,
  isOnTrail,
  terrainHeight,
} from "../forestTerrain";
import { configureForestAtmosphere } from "../lighting";
import { createForestSky } from "../forestSky";
import { createForestTerrain } from "../forestTerrainMesh";

const TREE_GRID = 10;
const MARGIN = 14;

interface TreePlacement {
  x: number;
  z: number;
  radius: number;
  trunkH: number;
  trunkR: number;
  foliageH: number;
  foliageR: number;
  foliageY: number;
}

export function setupForestWorld(scene: Scene): ObstacleField {
  configureForestAtmosphere(scene);
  createForestSky(scene);
  createForestTerrain(scene);
  placeForestHillMarkers(scene);
  return placeForestTrees(scene);
}

export const FOREST_HEMI_GROUND = new Color3(0.32, 0.38, 0.26);
export const FOREST_HEMI_DIFFUSE = new Color3(0.72, 0.82, 0.68);
export const FOREST_SUN_DIFFUSE = new Color3(0.92, 0.96, 0.82);
export const FOREST_SUN_SPECULAR = new Color3(0.75, 0.82, 0.65);

function placeForestTrees(scene: Scene): ObstacleField {
  const placements = generateTreePlacements();
  const obstacles: CircleObstacle[] = placements.map((t) => ({
    x: t.x,
    z: t.z,
    radius: t.radius,
  }));

  const trunkMat = new StandardMaterial("treeTrunk", scene);
  trunkMat.diffuseColor = new Color3(0.38, 0.26, 0.14);
  trunkMat.specularColor = new Color3(0.05, 0.04, 0.03);

  const foliageMat = new StandardMaterial("treeFoliage", scene);
  foliageMat.diffuseColor = new Color3(0.18, 0.48, 0.22);
  foliageMat.specularColor = new Color3(0.04, 0.06, 0.04);

  const trunkProto = MeshBuilder.CreateCylinder(
    "trunkProto",
    { height: 1, diameter: 1, tessellation: 8 },
    scene,
  );
  trunkProto.material = trunkMat;
  trunkProto.isVisible = false;

  const foliageProto = MeshBuilder.CreateCylinder(
    "foliageProto",
    { height: 1, diameterTop: 0.05, diameterBottom: 1, tessellation: 10 },
    scene,
  );
  foliageProto.material = foliageMat;
  foliageProto.isVisible = false;

  const root = new TransformNode("forestTrees", scene);

  for (let i = 0; i < placements.length; i++) {
    const t = placements[i]!;
    const y = terrainHeight(t.x, t.z);

    const trunk = trunkProto.createInstance(`trunk_${i}`);
    trunk.parent = root;
    trunk.scaling.set(t.trunkR * 2, t.trunkH, t.trunkR * 2);
    trunk.position.set(t.x, y + t.trunkH * 0.5, t.z);

    const foliage = foliageProto.createInstance(`foliage_${i}`);
    foliage.parent = root;
    foliage.scaling.set(t.foliageR * 2, t.foliageH, t.foliageR * 2);
    foliage.position.set(t.x, y + t.foliageY, t.z);
  }

  return new ObstacleField(obstacles);
}

function generateTreePlacements(): TreePlacement[] {
  const half = TERRAIN_SIZE / 2 - MARGIN;
  const trees: TreePlacement[] = [];

  for (let gx = -half; gx <= half; gx += TREE_GRID) {
    for (let gz = -half; gz <= half; gz += TREE_GRID) {
      const jitter = TREE_GRID * 0.42;
      const x = gx + (hash(gx, gz) - 0.5) * jitter;
      const z = gz + (hash(gz, gx + 17) - 0.5) * jitter;

      const radius = 1.0 + hash(x, z) * 0.7;
      if (
        isOnTrail(x, z, TRAIL_TREE_BUFFER + radius) ||
        isNearForestHill(x, z, TRAIL_TREE_BUFFER + radius)
      ) {
        continue;
      }

      const scale = 0.85 + hash(x + 3, z + 7) * 0.5;
      const trunkH = 3.2 * scale;
      const trunkR = 0.28 * scale;
      const foliageH = 4.5 * scale;
      const foliageR = 1.6 * scale;

      trees.push({
        x,
        z,
        radius,
        trunkH,
        trunkR,
        foliageH,
        foliageR,
        foliageY: trunkH + foliageH * 0.42,
      });
    }
  }

  return trees;
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function placeForestHillMarkers(scene: Scene): void {
  const summitY = terrainHeight(FOREST_HILL_X, FOREST_HILL_Z);

  const woodMat = new StandardMaterial("hillWood", scene);
  woodMat.diffuseColor = new Color3(0.42, 0.28, 0.14);
  woodMat.specularColor = new Color3(0.05, 0.04, 0.03);

  const flagMat = new StandardMaterial("hillFlag", scene);
  flagMat.diffuseColor = new Color3(0.82, 0.18, 0.14);
  flagMat.specularColor = new Color3(0.1, 0.05, 0.05);

  const postMat = new StandardMaterial("hillPost", scene);
  postMat.diffuseColor = new Color3(0.55, 0.38, 0.18);
  postMat.specularColor = new Color3(0.05, 0.04, 0.03);

  // Wooden lookout post at the summit
  const pole = MeshBuilder.CreateCylinder(
    "forestHillPole",
    { diameter: 0.32, height: 9, tessellation: 8 },
    scene,
  );
  pole.position.set(FOREST_HILL_X, summitY + 4.5, FOREST_HILL_Z);
  pole.material = woodMat;
  pole.isPickable = false;

  const flag = MeshBuilder.CreateBox(
    "forestHillFlag",
    { width: 2.2, height: 0.9, depth: 0.06 },
    scene,
  );
  flag.position.set(FOREST_HILL_X + 1.15, summitY + 8.2, FOREST_HILL_Z);
  flag.material = flagMat;
  flag.isPickable = false;

  // Trail posts around the base so the hill is easy to spot
  const POST_COUNT = 8;
  for (let i = 0; i < POST_COUNT; i++) {
    const angle = (i / POST_COUNT) * Math.PI * 2;
    const px = FOREST_HILL_X + Math.sin(angle) * (FOREST_HILL_RADIUS + 2);
    const pz = FOREST_HILL_Z + Math.cos(angle) * (FOREST_HILL_RADIUS + 2);
    const py = terrainHeight(px, pz);
    const postH = 2.2;

    const post = MeshBuilder.CreateCylinder(
      `forestHillPost${i}`,
      { diameter: 0.22, height: postH, tessellation: 6 },
      scene,
    );
    post.position.set(px, py + postH / 2, pz);
    post.material = postMat;
    post.isPickable = false;
  }
}
