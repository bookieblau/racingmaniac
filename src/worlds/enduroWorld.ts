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
  ENDURO_CHECKPOINTS,
  ENDURO_HILL_X,
  ENDURO_HILL_Z,
  ROCK_ZONE_RADIUS,
  ROCK_ZONE_X,
  ROCK_ZONE_Z,
  TERRAIN_SIZE,
  TRAIL_TREE_BUFFER,
  courseBiome,
  isNearHill,
  isOnCourse,
  terrainHeight,
} from "../enduroTerrain";
import { configureEnduroAtmosphere } from "../lighting";
import { createEnduroSky } from "../enduroSky";
import { createEnduroTerrain } from "../enduroTerrainMesh";

const TREE_GRID = 11;
const ROCK_GRID = 9;
const MARGIN = 14;

export function setupEnduroWorld(scene: Scene): ObstacleField {
  configureEnduroAtmosphere(scene);
  createEnduroSky(scene);
  createEnduroTerrain(scene);
  placeStartGate(scene);
  placeCheckpointMarkers(scene);
  placeSummitFlag(scene);
  return buildObstacles(scene);
}

export const ENDURO_HEMI_GROUND = new Color3(0.42, 0.38, 0.28);
export const ENDURO_HEMI_DIFFUSE = new Color3(0.88, 0.84, 0.74);
export const ENDURO_SUN_DIFFUSE = new Color3(1, 0.94, 0.8);
export const ENDURO_SUN_SPECULAR = new Color3(0.88, 0.82, 0.68);

function buildObstacles(scene: Scene): ObstacleField {
  const trees = generateTrees();
  const rocks = generateRocks();
  const obstacles = [...trees, ...rocks];

  const trunkMat = new StandardMaterial("enduroTrunk", scene);
  trunkMat.diffuseColor = new Color3(0.38, 0.26, 0.14);
  trunkMat.specularColor = new Color3(0.05, 0.04, 0.03);

  const foliageMat = new StandardMaterial("enduroFoliage", scene);
  foliageMat.diffuseColor = new Color3(0.18, 0.48, 0.22);
  foliageMat.specularColor = new Color3(0.04, 0.06, 0.04);

  const rockMat = new StandardMaterial("enduroRock", scene);
  rockMat.diffuseColor = new Color3(0.52, 0.48, 0.42);
  rockMat.specularColor = new Color3(0.08, 0.07, 0.06);

  const trunkProto = MeshBuilder.CreateCylinder(
    "enduroTrunkProto",
    { height: 1, diameter: 1, tessellation: 8 },
    scene,
  );
  trunkProto.material = trunkMat;
  trunkProto.isVisible = false;

  const foliageProto = MeshBuilder.CreateCylinder(
    "enduroFoliageProto",
    { height: 1, diameterTop: 0.05, diameterBottom: 1, tessellation: 10 },
    scene,
  );
  foliageProto.material = foliageMat;
  foliageProto.isVisible = false;

  const rockProto = MeshBuilder.CreatePolyhedron(
    "enduroRockProto",
    { type: 1, size: 1 },
    scene,
  );
  rockProto.material = rockMat;
  rockProto.isVisible = false;

  const root = new TransformNode("enduroObstacles", scene);
  let treeIdx = 0;
  let rockIdx = 0;

  for (const t of trees) {
    const y = terrainHeight(t.x, t.z);
    const scale = t.radius / 1.1;
    const trunkH = 3.0 * scale;
    const foliageH = 4.0 * scale;
    const trunkR = 0.26 * scale;
    const foliageR = 1.5 * scale;

    const trunk = trunkProto.createInstance(`enduroTrunk_${treeIdx}`);
    trunk.parent = root;
    trunk.scaling.set(trunkR * 2, trunkH, trunkR * 2);
    trunk.position.set(t.x, y + trunkH * 0.5, t.z);

    const foliage = foliageProto.createInstance(`enduroFoliage_${treeIdx}`);
    foliage.parent = root;
    foliage.scaling.set(foliageR * 2, foliageH, foliageR * 2);
    foliage.position.set(t.x, y + trunkH + foliageH * 0.4, t.z);
    treeIdx++;
  }

  for (const r of rocks) {
    const y = terrainHeight(r.x, r.z);
    const rock = rockProto.createInstance(`enduroRock_${rockIdx}`);
    rock.parent = root;
    const s = r.radius * 1.6;
    rock.scaling.set(s, s * 0.8, s * 1.1);
    rock.position.set(r.x, y + r.radius * 0.5, r.z);
    rockIdx++;
  }

  return new ObstacleField(obstacles);
}

function generateTrees(): CircleObstacle[] {
  const half = TERRAIN_SIZE / 2 - MARGIN;
  const trees: CircleObstacle[] = [];

  for (let gx = -half; gx <= half; gx += TREE_GRID) {
    for (let gz = -half; gz <= half; gz += TREE_GRID) {
      const jitter = TREE_GRID * 0.4;
      const x = gx + (hash(gx, gz) - 0.5) * jitter;
      const z = gz + (hash(gz, gx + 11) - 0.5) * jitter;

      if (courseBiome(x, z) !== "forest" && !isNearHill(x, z, 6)) continue;

      const radius = 0.9 + hash(x, z) * 0.6;
      if (
        isOnCourse(x, z, TRAIL_TREE_BUFFER + radius) ||
        isNearHill(x, z, TRAIL_TREE_BUFFER + radius)
      ) {
        continue;
      }

      trees.push({ x, z, radius });
    }
  }

  return trees;
}

function generateRocks(): CircleObstacle[] {
  const rocks: CircleObstacle[] = [];

  for (let gx = -ROCK_ZONE_RADIUS; gx <= ROCK_ZONE_RADIUS; gx += ROCK_GRID) {
    for (let gz = -ROCK_ZONE_RADIUS; gz <= ROCK_ZONE_RADIUS; gz += ROCK_GRID) {
      const x = ROCK_ZONE_X + gx + (hash(gx, gz) - 0.5) * ROCK_GRID * 0.5;
      const z = ROCK_ZONE_Z + gz + (hash(gz, gx) - 0.5) * ROCK_GRID * 0.5;
      if (Math.hypot(x - ROCK_ZONE_X, z - ROCK_ZONE_Z) > ROCK_ZONE_RADIUS - 4) continue;

      const radius = 0.7 + hash(x, z) * 0.8;
      if (isOnCourse(x, z, TRAIL_TREE_BUFFER + radius)) continue;

      rocks.push({ x, z, radius });
    }
  }

  return rocks;
}

function placeStartGate(scene: Scene): void {
  const y = terrainHeight(0, -35);
  const postMat = new StandardMaterial("startPost", scene);
  postMat.diffuseColor = new Color3(0.92, 0.92, 0.92);
  postMat.specularColor = new Color3(0.1, 0.1, 0.1);

  const bannerMat = new StandardMaterial("startBanner", scene);
  bannerMat.diffuseColor = new Color3(0.12, 0.12, 0.12);
  bannerMat.specularColor = Color3.Black();

  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(
      `startPost${side}`,
      { width: 0.35, height: 4.2, depth: 0.35 },
      scene,
    );
    post.position.set(side * 8, y + 2.1, -35);
    post.material = postMat;
    post.isPickable = false;
  }

  const banner = MeshBuilder.CreateBox(
    "startBanner",
    { width: 16, height: 0.9, depth: 0.08 },
    scene,
  );
  banner.position.set(0, y + 4.0, -35);
  banner.material = bannerMat;
  banner.isPickable = false;

  for (let i = 0; i < 8; i++) {
    const stripe = MeshBuilder.CreateBox(
      `startStripe${i}`,
      { width: 1.9, height: 0.9, depth: 0.09 },
      scene,
    );
    const white = i % 2 === 0;
    const mat = new StandardMaterial(`startStripeMat${i}`, scene);
    mat.diffuseColor = white ? new Color3(0.95, 0.95, 0.95) : new Color3(0.1, 0.1, 0.1);
    mat.specularColor = Color3.Black();
    stripe.material = mat;
    stripe.position.set(-6.65 + i * 1.9, y + 4.0, -35);
    stripe.isPickable = false;
  }
}

function placeCheckpointMarkers(scene: Scene): void {
  const postMat = new StandardMaterial("cpPost", scene);
  postMat.diffuseColor = new Color3(0.95, 0.82, 0.08);
  postMat.specularColor = new Color3(0.1, 0.08, 0.04);

  const flagMat = new StandardMaterial("cpFlag", scene);
  flagMat.diffuseColor = new Color3(0.92, 0.2, 0.14);
  flagMat.specularColor = new Color3(0.1, 0.05, 0.05);

  ENDURO_CHECKPOINTS.forEach((cp, i) => {
    if (i === ENDURO_CHECKPOINTS.length - 1) return;

    const y = terrainHeight(cp.x, cp.z);
    const post = MeshBuilder.CreateCylinder(
      `cpPost${i}`,
      { diameter: 0.24, height: 3.2, tessellation: 6 },
      scene,
    );
    post.position.set(cp.x, y + 1.6, cp.z);
    post.material = postMat;
    post.isPickable = false;

    const flag = MeshBuilder.CreateBox(
      `cpFlag${i}`,
      { width: 1.4, height: 0.55, depth: 0.05 },
      scene,
    );
    flag.position.set(cp.x + 0.75, y + 2.9, cp.z);
    flag.material = flagMat;
    flag.isPickable = false;
  });
}

function placeSummitFlag(scene: Scene): void {
  const y = terrainHeight(ENDURO_HILL_X, ENDURO_HILL_Z);
  const poleMat = new StandardMaterial("summitPole", scene);
  poleMat.diffuseColor = new Color3(0.42, 0.28, 0.14);

  const flagMat = new StandardMaterial("summitFlag", scene);
  flagMat.diffuseColor = new Color3(0.12, 0.55, 0.22);

  const pole = MeshBuilder.CreateCylinder(
    "summitPole",
    { diameter: 0.3, height: 8, tessellation: 8 },
    scene,
  );
  pole.position.set(ENDURO_HILL_X, y + 4, ENDURO_HILL_Z);
  pole.material = poleMat;
  pole.isPickable = false;

  const flag = MeshBuilder.CreateBox(
    "summitFlag",
    { width: 2.0, height: 0.8, depth: 0.06 },
    scene,
  );
  flag.position.set(ENDURO_HILL_X + 1.05, y + 7.6, ENDURO_HILL_Z);
  flag.material = flagMat;
  flag.isPickable = false;
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
