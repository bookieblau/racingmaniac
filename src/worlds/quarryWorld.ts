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
  BOWL_CENTER_X,
  BOWL_CENTER_Z,
  BOWL_RIM_RADIUS,
  NORTH_CLIMB_RADIUS,
  NORTH_CLIMB_X,
  NORTH_CLIMB_Z,
  OBSTACLE_BUFFER,
  QUARRY_CHECKPOINTS,
  ROCK_GARDEN_RADIUS,
  ROCK_GARDEN_X,
  ROCK_GARDEN_Z,
  TERRAIN_SIZE,
  isInBowl,
  isInRockGarden,
  isNearStream,
  isOnCourse,
  terrainHeight,
} from "../quarryTerrain";
import { configureQuarryAtmosphere } from "../lighting";
import { createQuarrySky } from "../quarrySky";
import { createQuarryTerrain } from "../quarryTerrainMesh";

const ROCK_GRID = 7;
const MARGIN = 12;

export function setupQuarryWorld(scene: Scene): ObstacleField {
  configureQuarryAtmosphere(scene);
  createQuarrySky(scene);
  createQuarryTerrain(scene);
  placeStartGate(scene);
  placeCheckpointMarkers(scene);
  placeSummitMarker(scene);
  placeCourseArrows(scene);
  return buildRocks(scene);
}

export const QUARRY_HEMI_GROUND = new Color3(0.26, 0.28, 0.27);
export const QUARRY_HEMI_DIFFUSE = new Color3(0.68, 0.70, 0.72);
export const QUARRY_SUN_DIFFUSE = new Color3(0.86, 0.86, 0.84);
export const QUARRY_SUN_SPECULAR = new Color3(0.62, 0.63, 0.65);

function buildRocks(scene: Scene): ObstacleField {
  const rocks = generateRocks();

  const rockMat = new StandardMaterial("quarryRock", scene);
  rockMat.diffuseColor = new Color3(0.46, 0.48, 0.50);
  rockMat.specularColor = new Color3(0.06, 0.06, 0.07);

  const proto = MeshBuilder.CreatePolyhedron("quarryRockProto", { type: 1, size: 1 }, scene);
  proto.material = rockMat;
  proto.isVisible = false;

  const root = new TransformNode("quarryRocks", scene);
  rocks.forEach((r, i) => {
    const y = terrainHeight(r.x, r.z);
    const rock = proto.createInstance(`quarryRock_${i}`);
    rock.parent = root;
    const s = r.radius * 1.5;
    rock.scaling.set(s, s * 0.75, s * 1.15);
    rock.position.set(r.x, y + r.radius * 0.45, r.z);
  });

  return new ObstacleField(rocks);
}

function generateRocks(): CircleObstacle[] {
  const rocks: CircleObstacle[] = [];
  const half = TERRAIN_SIZE / 2 - MARGIN;

  for (let gx = -half; gx <= half; gx += ROCK_GRID) {
    for (let gz = -half; gz <= half; gz += ROCK_GRID) {
      const x = gx + (hash(gx, gz) - 0.5) * ROCK_GRID * 0.55;
      const z = gz + (hash(gz, gx) - 0.5) * ROCK_GRID * 0.55;

      const inGarden = isInRockGarden(x, z);
      const inStream = isNearStream(x, z, 0);
      const inBowlWall = isInBowl(x, z, -12) && !isInBowl(x, z, -35);
      if (!inGarden && !inStream && !inBowlWall) continue;

      const radius = 0.55 + hash(x, z) * 0.75;
      if (isOnCourse(x, z, OBSTACLE_BUFFER + radius)) continue;

      if (inGarden && hash(x + 1, z) > 0.25) rocks.push({ x, z, radius });
      else if (inStream && hash(x, z + 2) > 0.35) rocks.push({ x, z, radius: radius * 0.85 });
      else if (inBowlWall && hash(x + 3, z + 1) > 0.55) rocks.push({ x, z, radius: radius * 0.7 });
    }
  }

  // Extra boulders on north climb face
  for (let i = 0; i < 28; i++) {
    const angle = hash(i, i * 3) * Math.PI * 2;
    const dist = NORTH_CLIMB_RADIUS * (0.35 + hash(i, i) * 0.55);
    const x = NORTH_CLIMB_X + Math.sin(angle) * dist;
    const z = NORTH_CLIMB_Z + Math.cos(angle) * dist;
    const radius = 0.5 + hash(x, z) * 0.65;
    if (isOnCourse(x, z, OBSTACLE_BUFFER + radius)) continue;
    rocks.push({ x, z, radius });
  }

  return rocks;
}

function placeStartGate(scene: Scene): void {
  const y = terrainHeight(0, -155);
  const postMat = new StandardMaterial("quarryStartPost", scene);
  postMat.diffuseColor = new Color3(0.9, 0.9, 0.9);

  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(`quarryStartPost${side}`, { width: 0.3, height: 3.8, depth: 0.3 }, scene);
    post.position.set(side * 5, y + 1.9, -155);
    post.material = postMat;
    post.isPickable = false;
  }

  for (let i = 0; i < 6; i++) {
    const stripe = MeshBuilder.CreateBox(`quarryStartStripe${i}`, { width: 1.5, height: 0.7, depth: 0.06 }, scene);
    const mat = new StandardMaterial(`quarryStripeMat${i}`, scene);
    mat.diffuseColor = i % 2 === 0 ? new Color3(0.95, 0.95, 0.95) : new Color3(0.1, 0.1, 0.1);
    stripe.material = mat;
    stripe.position.set(-3.75 + i * 1.5, y + 3.5, -155);
    stripe.isPickable = false;
  }

  const sign = MeshBuilder.CreateBox("quarrySign", { width: 4.5, height: 0.8, depth: 0.1 }, scene);
  const signMat = new StandardMaterial("quarrySignMat", scene);
  signMat.diffuseColor = new Color3(0.82, 0.18, 0.14);
  sign.material = signMat;
  sign.position.set(0, y + 4.6, -158);
  sign.isPickable = false;
}

function placeCheckpointMarkers(scene: Scene): void {
  const postMat = new StandardMaterial("quarryCpPost", scene);
  postMat.diffuseColor = new Color3(0.95, 0.82, 0.08);

  const flagMat = new StandardMaterial("quarryCpFlag", scene);
  flagMat.diffuseColor = new Color3(0.92, 0.2, 0.14);

  QUARRY_CHECKPOINTS.forEach((cp, i) => {
    if (i === QUARRY_CHECKPOINTS.length - 1) return;
    const y = terrainHeight(cp.x, cp.z);

    const post = MeshBuilder.CreateCylinder(`quarryCpPost${i}`, { diameter: 0.2, height: 2.8, tessellation: 6 }, scene);
    post.position.set(cp.x, y + 1.4, cp.z);
    post.material = postMat;
    post.isPickable = false;

    const flag = MeshBuilder.CreateBox(`quarryCpFlag${i}`, { width: 1.1, height: 0.45, depth: 0.04 }, scene);
    flag.position.set(cp.x + 0.6, y + 2.5, cp.z);
    flag.material = flagMat;
    flag.isPickable = false;
  });
}

function placeSummitMarker(scene: Scene): void {
  const y = terrainHeight(NORTH_CLIMB_X, NORTH_CLIMB_Z);
  const pole = MeshBuilder.CreateCylinder("quarrySummitPole", { diameter: 0.22, height: 6, tessellation: 8 }, scene);
  const poleMat = new StandardMaterial("quarrySummitPoleMat", scene);
  poleMat.diffuseColor = new Color3(0.42, 0.28, 0.14);
  pole.material = poleMat;
  pole.position.set(NORTH_CLIMB_X, y + 3, NORTH_CLIMB_Z);
  pole.isPickable = false;

  const flag = MeshBuilder.CreateBox("quarrySummitFlag", { width: 1.6, height: 0.6, depth: 0.05 }, scene);
  const flagMat = new StandardMaterial("quarrySummitFlagMat", scene);
  flagMat.diffuseColor = new Color3(0.12, 0.55, 0.22);
  flag.material = flagMat;
  flag.position.set(NORTH_CLIMB_X + 0.85, y + 5.8, NORTH_CLIMB_Z);
  flag.isPickable = false;
}

function placeCourseArrows(scene: Scene): void {
  const arrowMat = new StandardMaterial("quarryArrow", scene);
  arrowMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
  arrowMat.emissiveColor = new Color3(0.3, 0.3, 0.3);

  const arrowPositions: [number, number, number][] = [
    [0, -130, 0],
    [55, -72, -0.6],
    [10, 0, 0.4],
    [-20, 42, 0.8],
    [-8, 82, -0.3],
    [20, 106, 0.5],
    [-55, 88, -0.7],
    [-60, 20, 1.2],
    [0, -110, 0],
  ];

  arrowPositions.forEach(([x, z, rot], i) => {
    const y = terrainHeight(x, z);
    const arrow = MeshBuilder.CreateBox(`quarryArrow${i}`, { width: 1.2, height: 0.08, depth: 0.6 }, scene);
    arrow.position.set(x, y + 0.2, z);
    arrow.rotation.y = rot;
    arrow.material = arrowMat;
    arrow.isPickable = false;
  });

  // Rim markers around bowl
  const rimMat = new StandardMaterial("quarryRim", scene);
  rimMat.diffuseColor = new Color3(0.52, 0.54, 0.50);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const x = BOWL_CENTER_X + Math.sin(angle) * (BOWL_RIM_RADIUS + 3);
    const z = BOWL_CENTER_Z + Math.cos(angle) * (BOWL_RIM_RADIUS + 3);
    const y = terrainHeight(x, z);
    const post = MeshBuilder.CreateCylinder(`quarryRim${i}`, { diameter: 0.18, height: 1.6, tessellation: 5 }, scene);
    post.position.set(x, y + 0.8, z);
    post.material = rimMat;
    post.isPickable = false;
  }
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
