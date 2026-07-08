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
  TRAIL_RADIUS,
  trailSurfaceInfo,
  terrainHeight,
} from "./forestTerrain";

const FLOOR_TILE_METERS = 5;

export function createForestTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "forest",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    throw new Error("Forest terrain mesh has no positions");
  }

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const textures = createForestTextures(scene);
  const tileRepeat = TERRAIN_SIZE / FLOOR_TILE_METERS;

  const mat = new StandardMaterial("forestFloor", scene);
  mat.diffuseTexture = textures.diffuse;
  mat.bumpTexture = textures.bump;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.08, 0.1, 0.07);
  mat.ambientColor = new Color3(0.28, 0.34, 0.22);
  mat.bumpTexture.level = 0.32;

  textures.diffuse.uScale = tileRepeat;
  textures.diffuse.vScale = tileRepeat;
  textures.bump.uScale = tileRepeat;
  textures.bump.vScale = tileRepeat;

  ground.material = mat;
  ground.receiveShadows = true;

  return ground;
}

interface ForestTextures {
  diffuse: DynamicTexture;
  bump: DynamicTexture;
}

function createForestTextures(scene: Scene): ForestTextures {
  const size = 512;
  const diffuse = new DynamicTexture("forestDiffuse", size, scene, false);
  const bump = new DynamicTexture("forestBump", size, scene, false);

  const diffuseCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const dCtx = diffuseCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  if (!dCtx || !bCtx) {
    throw new Error("Unable to create forest texture canvas");
  }

  const dImage = dCtx.createImageData(size, size);
  const bImage = bCtx.createImageData(size, size);
  const half = TERRAIN_SIZE / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size) * TERRAIN_SIZE - half;
      const wz = (py / size) * TERRAIN_SIZE - half;

      const trail = trailSurfaceInfo(wx, wz);
      const onTrail = trail.dist < trail.radius;
      const trailBlend = onTrail
        ? 1 - trail.dist / trail.radius
        : Math.max(0, 1 - (trail.dist - trail.radius) / 3);

      const moss = fbm(wx * 0.08, wz * 0.08);
      const leaf = fbm(wx * 0.15 + 4, wz * 0.12);

      let red: number;
      let green: number;
      let blue: number;

      if (onTrail && trail.isHillTrail) {
        // Light sandy-brown path on the hill
        red = lerp(176, 212, trailBlend + moss * 0.1);
        green = lerp(142, 178, trailBlend + moss * 0.08);
        blue = lerp(96, 128, trailBlend);
      } else if (onTrail) {
        red = lerp(72, 118, trailBlend + moss * 0.15);
        green = lerp(58, 92, trailBlend + moss * 0.12);
        blue = lerp(38, 52, trailBlend);
      } else {
        red = lerp(34, 58, moss);
        green = lerp(88, 128, leaf);
        blue = lerp(28, 48, moss * 0.5);
      }

      const idx = (py * size + px) * 4;
      dImage.data[idx] = Math.floor(red);
      dImage.data[idx + 1] = Math.floor(green);
      dImage.data[idx + 2] = Math.floor(blue);
      dImage.data[idx + 3] = 255;

      const bumpVal = Math.floor(clamp01(0.48 + moss * 0.35 + (onTrail ? -0.08 : 0.06)) * 255);
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
