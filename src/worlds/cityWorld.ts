import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";
import { configureCityAtmosphere } from "../lighting";
import { createCitySky } from "../citySky";
import { createCityTerrain } from "../cityTerrainMesh";
import {
  CITY_BLOCK,
  TERRAIN_SIZE,
  terrainHeight,
} from "../cityTerrain";

// ── Seeded pseudo-random ──────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed;
  return function (): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeMat(scene: Scene, name: string, color: Color3, specular = 0.1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(specular, specular, specular);
  return m;
}

// ── Buildings ─────────────────────────────────────────────────────────────────

const BUILDING_COLORS = [
  new Color3(0.55, 0.58, 0.62),
  new Color3(0.48, 0.50, 0.54),
  new Color3(0.62, 0.56, 0.48),
  new Color3(0.42, 0.44, 0.50),
  new Color3(0.58, 0.52, 0.46),
];

function placeBuilding(
  scene: Scene,
  x: number,
  z: number,
  rng: () => number,
  downtown: boolean,
): void {
  const w = 9 + rng() * 8;
  const d = 9 + rng() * 8;
  const h = downtown
    ? 28 + rng() * 42
    : 10 + rng() * 22;

  const groundY = terrainHeight(x, z);
  const bodyColor = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)]!;
  const bodyMat = makeMat(scene, `bldgBody_${x}_${z}`, bodyColor, 0.12);
  const winMat = makeMat(scene, `bldgWin_${x}_${z}`, new Color3(0.55, 0.72, 0.92), 0.0);
  winMat.emissiveColor = new Color3(0.18, 0.24, 0.38);

  const body = MeshBuilder.CreateBox(`bldg_${x}_${z}`,
    { width: w, height: h, depth: d }, scene);
  body.position.set(x, groundY + h / 2, z);
  body.material = bodyMat;
  body.isPickable = false;

  // Window bands on front and side faces
  const rows = Math.floor(h / 3.2);
  for (let row = 1; row < rows; row++) {
    const wy = groundY + row * 3.0;
    const band = MeshBuilder.CreateBox(`win_${x}_${z}_${row}`,
      { width: w * 0.82, height: 0.9, depth: 0.08 }, scene);
    band.position.set(x, wy, z + d / 2 + 0.05);
    band.material = winMat;
    band.isPickable = false;

    const bandSide = MeshBuilder.CreateBox(`winS_${x}_${z}_${row}`,
      { width: 0.08, height: 0.9, depth: d * 0.82 }, scene);
    bandSide.position.set(x + w / 2 + 0.05, wy, z);
    bandSide.material = winMat;
    bandSide.isPickable = false;
  }

  // Rooftop detail on taller buildings
  if (h > 30) {
    const roof = MeshBuilder.CreateBox(`roof_${x}_${z}`,
      { width: w * 0.5, height: 2.5, depth: d * 0.5 }, scene);
    roof.position.set(x, groundY + h + 1.25, z);
    roof.material = makeMat(scene, `roofM_${x}_${z}`, new Color3(0.35, 0.36, 0.40), 0.2);
    roof.isPickable = false;
  }
}

function placeBuildings(scene: Scene): void {
  const rng = makeRng(201);
  const half = TERRAIN_SIZE / 2 - 20;
  const blocks = Math.floor((half * 2) / CITY_BLOCK);

  for (let bx = -blocks; bx <= blocks; bx++) {
    for (let bz = -blocks; bz <= blocks; bz++) {
      const cx = bx * CITY_BLOCK;
      const cz = bz * CITY_BLOCK;

      // Keep spawn intersection clear
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;

      const downtown = Math.abs(cx - 90) < 80 && Math.abs(cz + 50) < 80;

      // One building per lot quadrant, inset from roads
      const offsets: [number, number][] = [
        [12, 12], [-12, 12], [12, -12], [-12, -12],
      ];
      for (const [ox, oz] of offsets) {
        if (rng() < 0.12) continue;  // occasional empty lot / park gap
        placeBuilding(scene, cx + ox, cz + oz, rng, downtown);
      }
    }
  }
}

// ── Street lamps ──────────────────────────────────────────────────────────────

function placeStreetLamps(scene: Scene): void {
  const poleMat = makeMat(scene, "lampPole", new Color3(0.28, 0.28, 0.30), 0.4);
  const bulbMat = makeMat(scene, "lampBulb", new Color3(1.0, 0.95, 0.75), 0.0);
  bulbMat.emissiveColor = new Color3(0.85, 0.78, 0.45);

  const half = TERRAIN_SIZE / 2 - 16;
  const step = CITY_BLOCK;

  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      if (Math.abs(x) < 18 && Math.abs(z) < 18) continue;

      const gy = terrainHeight(x + 4, z + 4);
      const pole = MeshBuilder.CreateCylinder(`lamp_${x}_${z}`,
        { diameter: 0.22, height: 5.5, tessellation: 8 }, scene);
      pole.position.set(x + 4, gy + 2.75, z + 4);
      pole.material = poleMat;
      pole.isPickable = false;

      const bulb = MeshBuilder.CreateSphere(`bulb_${x}_${z}`,
        { diameter: 0.55, segments: 8 }, scene);
      bulb.position.set(x + 4, gy + 5.6, z + 4);
      bulb.material = bulbMat;
      bulb.isPickable = false;
    }
  }
}

// ── Parks (small green lots) ──────────────────────────────────────────────────

function placeParks(scene: Scene): void {
  const rng = makeRng(88);
  const grassMat = makeMat(scene, "parkGrass", new Color3(0.22, 0.48, 0.22), 0.05);
  grassMat.emissiveColor = new Color3(0.04, 0.12, 0.04);

  const parkSpots: [number, number][] = [
    [-70, 60], [120, -80], [-130, -100], [60, 130],
  ];

  for (const [px, pz] of parkSpots) {
    const gy = terrainHeight(px, pz);
    const park = MeshBuilder.CreateGround(`park_${px}_${pz}`,
      { width: 22, height: 22 }, scene);
    park.position.set(px, gy + 0.02, pz);
    park.material = grassMat;
    park.isPickable = false;

    // A few simple trees
    for (let t = 0; t < 5; t++) {
      const tx = px + (rng() - 0.5) * 16;
      const tz = pz + (rng() - 0.5) * 16;
      const ty = terrainHeight(tx, tz);
      const trunk = MeshBuilder.CreateCylinder(`treeT_${px}_${t}`,
        { diameter: 0.5, height: 2.5, tessellation: 6 }, scene);
      trunk.position.set(tx, ty + 1.25, tz);
      trunk.material = makeMat(scene, `treeTr_${px}_${t}`, new Color3(0.35, 0.22, 0.12), 0.05);
      trunk.isPickable = false;

      const crown = MeshBuilder.CreateSphere(`treeC_${px}_${t}`,
        { diameter: 3.2, segments: 6 }, scene);
      crown.position.set(tx, ty + 3.6, tz);
      crown.material = grassMat;
      crown.isPickable = false;
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function populateCity(scene: Scene): void {
  placeBuildings(scene);
  placeStreetLamps(scene);
  placeParks(scene);
}

export function setupCityWorld(scene: Scene): void {
  configureCityAtmosphere(scene);
  createCitySky(scene);
  createCityTerrain(scene);
  populateCity(scene);
}

export const CITY_HEMI_GROUND = new Color3(0.35, 0.36, 0.40);
export const CITY_HEMI_DIFFUSE = new Color3(0.82, 0.84, 0.88);
export const CITY_SUN_DIFFUSE = new Color3(0.95, 0.94, 0.90);
export const CITY_SUN_SPECULAR = new Color3(0.7, 0.7, 0.75);
