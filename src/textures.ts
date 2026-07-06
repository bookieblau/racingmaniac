import { DynamicTexture, Scene, Texture } from "@babylonjs/core";

const TEXTURE_SIZE = 512;

export interface SandTextures {
  diffuse: DynamicTexture;
  bump: DynamicTexture;
}

export function createSandTextures(scene: Scene): SandTextures {
  const diffuse = new DynamicTexture("sandDiffuse", TEXTURE_SIZE, scene, false);
  const bump = new DynamicTexture("sandBump", TEXTURE_SIZE, scene, false);
  const diffuseContext = document.createElement("canvas").getContext("2d");
  const bumpCanvas = document.createElement("canvas");
  const bumpContext = bumpCanvas.getContext("2d");
  if (!diffuseContext || !bumpContext) {
    throw new Error("Unable to create texture canvas");
  }

  diffuseContext.canvas.width = TEXTURE_SIZE;
  diffuseContext.canvas.height = TEXTURE_SIZE;
  bumpCanvas.width = TEXTURE_SIZE;
  bumpCanvas.height = TEXTURE_SIZE;

  const image = diffuseContext.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const bumpImage = bumpContext.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);

  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = x / TEXTURE_SIZE;
      const v = y / TEXTURE_SIZE;

      const grain = fbm(u * 18, v * 18);
      const dunes = fbm(u * 3.2 + 12, v * 2.8) * 0.35;
      const ripples = Math.sin((u * 42 + v * 17) * Math.PI * 2) * 0.04;
      const shade = clamp01(0.52 + grain * 0.22 + dunes + ripples);

      const red = Math.floor(lerp(168, 214, shade));
      const green = Math.floor(lerp(126, 176, shade));
      const blue = Math.floor(lerp(72, 118, shade));
      const index = (y * TEXTURE_SIZE + x) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = 255;

      const height =
        fbm(u * 14, v * 14) * 0.55 +
        fbm(u * 36 + 4, v * 36 + 9) * 0.25 +
        dunes;
      const bumpValue = Math.floor(clamp01(0.5 + height * 0.45) * 255);
      bumpImage.data[index] = bumpValue;
      bumpImage.data[index + 1] = bumpValue;
      bumpImage.data[index + 2] = bumpValue;
      bumpImage.data[index + 3] = 255;
    }
  }

  diffuseContext.putImageData(image, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);
  diffuse.getContext().drawImage(diffuseContext.canvas, 0, 0);
  bump.getContext().drawImage(bumpCanvas, 0, 0);
  diffuse.update(false);
  bump.update(false);

  configureTextureSampling(diffuse);
  configureTextureSampling(bump);

  return { diffuse, bump };
}

function configureTextureSampling(texture: Texture): void {
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
}

function fbm(x: number, y: number): number {
  return (
    valueNoise(x, y) * 0.55 +
    valueNoise(x * 2.1, y * 2.1) * 0.25 +
    valueNoise(x * 4.3, y * 4.3) * 0.12 +
    valueNoise(x * 8.7, y * 8.7) * 0.08
  );
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = hash(x0, y0);
  const n10 = hash(x1, y0);
  const n01 = hash(x0, y1);
  const n11 = hash(x1, y1);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
