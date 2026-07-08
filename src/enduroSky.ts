import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";

const SKY_DIAMETER = 480;

export function createEnduroSky(scene: Scene): Mesh {
  const sky = MeshBuilder.CreateSphere(
    "enduroSky",
    { diameter: SKY_DIAMETER, segments: 36, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.isPickable = false;
  sky.infiniteDistance = true;

  const material = new StandardMaterial("enduroSkyMaterial", scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.emissiveTexture = createEnduroSkyGradient(scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  sky.material = material;

  return sky;
}

function createEnduroSkyGradient(scene: Scene): DynamicTexture {
  const width = 4;
  const height = 512;
  const texture = new DynamicTexture("enduroSkyGradient", { width, height }, scene, false);
  const context = texture.getContext();

  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const horizon = smoothstep(clamp01((t - 0.02) / 0.2));
    const zenith = smoothstep(clamp01((t - 0.36) / 0.64));

    const red = lerp(lerp(0.88, 0.72, horizon), 0.48, zenith);
    const green = lerp(lerp(0.78, 0.68, horizon), 0.62, zenith);
    const blue = lerp(lerp(0.62, 0.78, horizon), 0.94, zenith);

    context.fillStyle = `rgb(${Math.floor(red * 255)}, ${Math.floor(green * 255)}, ${Math.floor(
      blue * 255,
    )})`;
    context.fillRect(0, y, width, 1);
  }

  texture.update(false);
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  return texture;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
