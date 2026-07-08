import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  VertexBuffer,
} from "@babylonjs/core";
import { TERRAIN_SIZE, TERRAIN_SUBDIVISIONS, terrainHeight } from "./driftTerrain";

const TILE_METERS = 8;

export function createDriftTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "driftArena",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) throw new Error("Drift terrain mesh has no positions");

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const textures = createDriftTextures(scene);
  const tileRepeat = TERRAIN_SIZE / TILE_METERS;

  const mat = new StandardMaterial("driftFloor", scene);
  mat.diffuseTexture = textures.diffuse;
  mat.bumpTexture = textures.bump;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.14, 0.14, 0.14);
  mat.ambientColor = new Color3(0.38, 0.38, 0.36);
  mat.bumpTexture.level = 0.22;

  textures.diffuse.uScale = tileRepeat;
  textures.diffuse.vScale = tileRepeat;
  textures.bump.uScale = tileRepeat;
  textures.bump.vScale = tileRepeat;

  ground.material = mat;
  ground.receiveShadows = true;
  return ground;
}

function createDriftTextures(scene: Scene) {
  const size = 512;
  const diffuse = new DynamicTexture("driftDiffuse", size, scene, false);
  const bump = new DynamicTexture("driftBump", size, scene, false);

  const dCanvas = document.createElement("canvas");
  const bCanvas = document.createElement("canvas");
  dCanvas.width = bCanvas.width = size;
  dCanvas.height = bCanvas.height = size;

  const dCtx = dCanvas.getContext("2d");
  const bCtx = bCanvas.getContext("2d");
  if (!dCtx || !bCtx) throw new Error("Unable to create drift texture canvas");

  const dImage = dCtx.createImageData(size, size);
  const bImage = bCtx.createImageData(size, size);
  const half = TERRAIN_SIZE / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size) * TERRAIN_SIZE - half;
      const wz = (py / size) * TERRAIN_SIZE - half;

      const noise = fbm(wx * 0.12, wz * 0.12);
      const wear = fbm(wx * 0.04 + 8, wz * 0.04);

      // Dark asphalt with lighter worn patches from drifting
      const red = lerp(42, 58, noise) + wear * 12;
      const green = lerp(42, 56, noise) + wear * 10;
      const blue = lerp(44, 58, noise) + wear * 10;

      const idx = (py * size + px) * 4;
      dImage.data[idx] = Math.floor(red);
      dImage.data[idx + 1] = Math.floor(green);
      dImage.data[idx + 2] = Math.floor(blue);
      dImage.data[idx + 3] = 255;

      const bumpVal = Math.floor(clamp01(0.5 + noise * 0.15) * 255);
      bImage.data[idx] = bumpVal;
      bImage.data[idx + 1] = bumpVal;
      bImage.data[idx + 2] = bumpVal;
      bImage.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImage, 0, 0);
  bCtx.putImageData(bImage, 0, 0);
  diffuse.getContext().drawImage(dCanvas, 0, 0);
  bump.getContext().drawImage(bCanvas, 0, 0);
  diffuse.update(false);
  bump.update(false);

  diffuse.wrapU = bump.wrapU = Texture.WRAP_ADDRESSMODE;
  diffuse.wrapV = bump.wrapV = Texture.WRAP_ADDRESSMODE;
  return { diffuse, bump };
}

function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2.5, z * 2.5) * 0.4;
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const sx = smoothstep(x - x0);
  const sz = smoothstep(z - z0);
  return lerp(
    lerp(hash(x0, z0), hash(x0 + 1, z0), sx),
    lerp(hash(x0, z0 + 1), hash(x0 + 1, z0 + 1), sx),
    sz,
  );
}

function hash(x: number, z: number): number {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function smoothstep(t: number): number { return t * t * (3 - 2 * t); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
