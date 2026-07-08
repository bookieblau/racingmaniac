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
import {
  TERRAIN_SIZE,
  TERRAIN_SUBDIVISIONS,
  isInBowl,
  isNearStream,
  trailSurfaceInfo,
  terrainHeight,
} from "./quarryTerrain";
import type { TrailKind } from "./quarryTerrain";

const FLOOR_TILE_METERS = 4;

export function createQuarryTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "quarry",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) throw new Error("Quarry terrain mesh has no positions");

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const textures = createQuarryTextures(scene);
  const tileRepeat = TERRAIN_SIZE / FLOOR_TILE_METERS;

  const mat = new StandardMaterial("quarryFloor", scene);
  mat.diffuseTexture = textures.diffuse;
  mat.bumpTexture = textures.bump;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.08, 0.08, 0.09);
  mat.ambientColor = new Color3(0.34, 0.35, 0.38);
  mat.bumpTexture.level = 0.42;

  textures.diffuse.uScale = tileRepeat;
  textures.diffuse.vScale = tileRepeat;
  textures.bump.uScale = tileRepeat;
  textures.bump.vScale = tileRepeat;

  ground.material = mat;
  ground.receiveShadows = true;
  return ground;
}

function createQuarryTextures(scene: Scene) {
  const size = 512;
  const diffuse = new DynamicTexture("quarryDiffuse", size, scene, false);
  const bump = new DynamicTexture("quarryBump", size, scene, false);

  const dCanvas = document.createElement("canvas");
  const bCanvas = document.createElement("canvas");
  dCanvas.width = bCanvas.width = size;
  dCanvas.height = bCanvas.height = size;

  const dCtx = dCanvas.getContext("2d");
  const bCtx = bCanvas.getContext("2d");
  if (!dCtx || !bCtx) throw new Error("Unable to create quarry texture canvas");

  const dImage = dCtx.createImageData(size, size);
  const bImage = bCtx.createImageData(size, size);
  const half = TERRAIN_SIZE / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size) * TERRAIN_SIZE - half;
      const wz = (py / size) * TERRAIN_SIZE - half;

      const trail = trailSurfaceInfo(wx, wz);
      const onCourse = trail.dist < trail.radius;
      const blend = onCourse ? 1 - trail.dist / trail.radius : 0;
      const noise = fbm(wx * 0.14, wz * 0.14);
      const grassPatch = fbm(wx * 0.055 + 2, wz * 0.055);
      const inBowl = isInBowl(wx, wz);
      const inStream = isNearStream(wx, wz, 2);

      let red: number;
      let green: number;
      let blue: number;

      if (onCourse) {
        ({ red, green, blue } = courseColor(trail.kind, blend, noise));
      } else if (inStream) {
        // Wet slate in the rocky stream bed
        red = lerp(46, 62, noise);
        green = lerp(48, 60, noise);
        blue = lerp(54, 68, noise);
      } else if (inBowl) {
        // Exposed quarry slate and rubble
        red = lerp(82, 102, noise);
        green = lerp(84, 100, noise);
        blue = lerp(90, 108, noise);
      } else if (grassPatch > 0.5) {
        // Sparse Welsh hillside grass on the rim
        red = lerp(64, 82, grassPatch);
        green = lerp(76, 96, grassPatch);
        blue = lerp(44, 58, grassPatch);
      } else {
        // Grey stone and scree outside the bowl
        red = lerp(96, 116, noise);
        green = lerp(98, 112, noise);
        blue = lerp(92, 106, noise);
      }

      const idx = (py * size + px) * 4;
      dImage.data[idx] = Math.floor(red);
      dImage.data[idx + 1] = Math.floor(green);
      dImage.data[idx + 2] = Math.floor(blue);
      dImage.data[idx + 3] = 255;

      const bumpVal = Math.floor(clamp01(0.52 + noise * 0.38 + (onCourse ? -0.05 : 0.04)) * 255);
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

function courseColor(kind: TrailKind, blend: number, noise: number) {
  switch (kind) {
    case "single":
      return {
        red: lerp(108, 128, blend),
        green: lerp(100, 118, blend),
        blue: lerp(88, 102, blend),
      };
    case "climb":
      return {
        red: lerp(128, 152, blend + noise * 0.08),
        green: lerp(126, 148, blend),
        blue: lerp(122, 142, blend),
      };
    case "stream":
      return {
        red: lerp(52, 72, blend + noise * 0.1),
        green: lerp(54, 70, blend),
        blue: lerp(60, 78, blend),
      };
    case "rock":
      return {
        red: lerp(88, 110, blend),
        green: lerp(90, 108, blend),
        blue: lerp(94, 114, blend),
      };
    default:
      // Worn gravel haul roads
      return {
        red: lerp(142, 166, blend),
        green: lerp(132, 152, blend),
        blue: lerp(112, 132, blend),
      };
  }
}

function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2.3, z * 2.3) * 0.25 + valueNoise(x * 5, z * 5) * 0.15;
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
