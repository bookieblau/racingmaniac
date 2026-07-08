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
  courseBiome,
  trailSurfaceInfo,
  terrainHeight,
} from "./enduroTerrain";
import type { TrailKind } from "./enduroTerrain";

const FLOOR_TILE_METERS = 5;

export function createEnduroTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "enduro",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    throw new Error("Enduro terrain mesh has no positions");
  }

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const textures = createEnduroTextures(scene);
  const tileRepeat = TERRAIN_SIZE / FLOOR_TILE_METERS;

  const mat = new StandardMaterial("enduroFloor", scene);
  mat.diffuseTexture = textures.diffuse;
  mat.bumpTexture = textures.bump;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.08, 0.09, 0.07);
  mat.ambientColor = new Color3(0.3, 0.3, 0.24);
  mat.bumpTexture.level = 0.34;

  textures.diffuse.uScale = tileRepeat;
  textures.diffuse.vScale = tileRepeat;
  textures.bump.uScale = tileRepeat;
  textures.bump.vScale = tileRepeat;

  ground.material = mat;
  ground.receiveShadows = true;

  return ground;
}

interface EnduroTextures {
  diffuse: DynamicTexture;
  bump: DynamicTexture;
}

function createEnduroTextures(scene: Scene): EnduroTextures {
  const size = 512;
  const diffuse = new DynamicTexture("enduroDiffuse", size, scene, false);
  const bump = new DynamicTexture("enduroBump", size, scene, false);

  const diffuseCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  diffuseCanvas.width = size;
  bumpCanvas.width = size;
  diffuseCanvas.height = size;
  bumpCanvas.height = size;

  const dCtx = diffuseCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  if (!dCtx || !bCtx) {
    throw new Error("Unable to create enduro texture canvas");
  }

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
      const biome = courseBiome(wx, wz);
      const noise = fbm(wx * 0.1, wz * 0.1);

      let red: number;
      let green: number;
      let blue: number;

      if (onCourse) {
        ({ red, green, blue } = courseTrackColor(trail.kind, blend, noise));
      } else {
        ({ red, green, blue } = offCourseColor(biome, noise));
      }

      const idx = (py * size + px) * 4;
      dImage.data[idx] = Math.floor(red);
      dImage.data[idx + 1] = Math.floor(green);
      dImage.data[idx + 2] = Math.floor(blue);
      dImage.data[idx + 3] = 255;

      const bumpVal = Math.floor(clamp01(0.5 + noise * 0.3 + (onCourse ? -0.06 : 0)) * 255);
      bImage.data[idx] = bumpVal;
      bImage.data[idx + 1] = bumpVal;
      bImage.data[idx + 2] = bumpVal;
      bImage.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImage, 0, 0);
  bCtx.putImageData(bImage, 0, 0);
  diffuse.getContext().drawImage(diffuseCanvas, 0, 0);
  bump.getContext().drawImage(bumpCanvas, 0, 0);
  diffuse.update(false);
  bump.update(false);

  diffuse.wrapU = Texture.WRAP_ADDRESSMODE;
  diffuse.wrapV = Texture.WRAP_ADDRESSMODE;
  bump.wrapU = Texture.WRAP_ADDRESSMODE;
  bump.wrapV = Texture.WRAP_ADDRESSMODE;

  return { diffuse, bump };
}

function courseTrackColor(kind: TrailKind, blend: number, noise: number): { red: number; green: number; blue: number } {
  switch (kind) {
    case "forest":
      return { red: lerp(118, 148, blend), green: lerp(96, 122, blend), blue: lerp(62, 78, blend) };
    case "hill":
      return { red: lerp(182, 210, blend), green: lerp(148, 176, blend), blue: lerp(98, 124, blend) };
    case "rock":
      return { red: lerp(132, 158, blend), green: lerp(118, 138, blend), blue: lerp(92, 108, blend) };
    case "mud":
      return { red: lerp(88, 108, blend + noise * 0.1), green: lerp(68, 82, blend), blue: lerp(42, 52, blend) };
    default:
      return { red: lerp(168, 198, blend), green: lerp(138, 168, blend), blue: lerp(92, 118, blend) };
  }
}

function offCourseColor(biome: TrailKind, noise: number): { red: number; green: number; blue: number } {
  switch (biome) {
    case "forest":
      return { red: lerp(34, 54, noise), green: lerp(88, 122, noise), blue: lerp(28, 44, noise) };
    case "hill":
      return { red: lerp(72, 96, noise), green: lerp(98, 118, noise), blue: lerp(48, 62, noise) };
    case "rock":
      return { red: lerp(96, 118, noise), green: lerp(88, 102, noise), blue: lerp(72, 86, noise) };
    case "mud":
      return { red: lerp(58, 78, noise), green: lerp(48, 62, noise), blue: lerp(32, 42, noise) };
    default:
      return { red: lerp(148, 172, noise), green: lerp(126, 148, noise), blue: lerp(82, 98, noise) };
  }
}

function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.2, z * 2.2) * 0.25 +
    valueNoise(x * 4.5, z * 4.5) * 0.12 +
    valueNoise(x * 9, z * 9) * 0.08
  );
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const sx = smoothstep(x - x0);
  const sz = smoothstep(z - z0);
  return lerp(
    lerp(hash(x0, z0), hash(x1, z0), sx),
    lerp(hash(x0, z1), hash(x1, z1), sx),
    sz,
  );
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
