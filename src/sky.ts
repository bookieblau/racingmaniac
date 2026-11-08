import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";
import type { WorldId } from "./worldTypes";

const SKY_DIAMETER = 920;

export function createDesertSky(scene: Scene): Mesh {
  return createWorldSky(scene, "desert");
}

export function createWorldSky(scene: Scene, worldId: WorldId): Mesh {
  const sky = MeshBuilder.CreateSphere(
    "sky",
    { diameter: SKY_DIAMETER, segments: 48, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.isPickable = false;
  sky.infiniteDistance = true;
  sky.renderingGroupId = 0;

  const material = new StandardMaterial(`skyMat_${worldId}`, scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.emissiveTexture = createSkyGradientTexture(scene, worldId);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  sky.material = material;

  return sky;
}

function createSkyGradientTexture(scene: Scene, worldId: WorldId): DynamicTexture {
  const width = 8;
  const height = 1024;
  const texture = new DynamicTexture(`skyGrad_${worldId}`, { width, height }, scene, false);
  const ctx = texture.getContext();

  const profiles = SKY_PROFILES[worldId] ?? SKY_PROFILES.desert;

  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const horizon = smoothstep(clamp01((t - 0.02) / 0.18));
    const zenith = smoothstep(clamp01((t - 0.32) / 0.68));

    let red = lerp(lerp(profiles.horizon[0], profiles.mid[0], horizon), profiles.zenith[0], zenith);
    let green = lerp(lerp(profiles.horizon[1], profiles.mid[1], horizon), profiles.zenith[1], zenith);
    let blue = lerp(lerp(profiles.horizon[2], profiles.mid[2], horizon), profiles.zenith[2], zenith);

    const sunY = 0.58;
    const sunDist = Math.abs(t - sunY);
    const sunGlow = Math.exp(-sunDist * sunDist * 320) * 0.55;
    const sunCore = Math.exp(-sunDist * sunDist * 2200) * 0.95;
    red = Math.min(1, red + sunGlow * 0.35 + sunCore);
    green = Math.min(1, green + sunGlow * 0.28 + sunCore * 0.92);
    blue = Math.min(1, blue + sunGlow * 0.15 + sunCore * 0.7);

    ctx.fillStyle = `rgb(${Math.floor(red * 255)}, ${Math.floor(green * 255)}, ${Math.floor(blue * 255)})`;
    ctx.fillRect(0, y, width, 1);
  }

  texture.update(false);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  return texture;
}

type SkyStop = { horizon: [number, number, number]; mid: [number, number, number]; zenith: [number, number, number] };

const SKY_PROFILES: Record<WorldId, SkyStop> = {
  desert: {
    horizon: [0.95, 0.82, 0.58],
    mid: [0.78, 0.68, 0.75],
    zenith: [0.42, 0.62, 0.95],
  },
  moto: {
    horizon: [0.92, 0.88, 0.72],
    mid: [0.72, 0.82, 0.78],
    zenith: [0.38, 0.58, 0.92],
  },
  forest: {
    horizon: [0.72, 0.82, 0.62],
    mid: [0.58, 0.72, 0.68],
    zenith: [0.35, 0.55, 0.78],
  },
  enduro: {
    horizon: [0.9, 0.84, 0.65],
    mid: [0.7, 0.72, 0.7],
    zenith: [0.4, 0.6, 0.88],
  },
  quarry: {
    horizon: [0.82, 0.8, 0.74],
    mid: [0.62, 0.66, 0.7],
    zenith: [0.45, 0.52, 0.62],
  },
  drift: {
    horizon: [0.88, 0.9, 0.94],
    mid: [0.72, 0.78, 0.88],
    zenith: [0.5, 0.62, 0.85],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
