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

export function createDriftSky(scene: Scene): Mesh {
  const sky = MeshBuilder.CreateSphere(
    "driftSky",
    { diameter: SKY_DIAMETER, segments: 36, sideOrientation: Mesh.BACKSIDE },
    scene,
  );
  sky.isPickable = false;
  sky.infiniteDistance = true;

  const material = new StandardMaterial("driftSkyMat", scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.emissiveTexture = createDriftSkyGradient(scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  sky.material = material;
  return sky;
}

function createDriftSkyGradient(scene: Scene): DynamicTexture {
  const width = 4;
  const height = 512;
  const texture = new DynamicTexture("driftSkyGradient", { width, height }, scene, false);
  const context = texture.getContext();

  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const horizon = smoothstep(clamp01((t - 0.02) / 0.2));
    const zenith = smoothstep(clamp01((t - 0.35) / 0.65));

    const red = lerp(lerp(0.82, 0.68, horizon), 0.45, zenith);
    const green = lerp(lerp(0.86, 0.74, horizon), 0.62, zenith);
    const blue = lerp(lerp(0.94, 0.88, horizon), 0.95, zenith);

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

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function smoothstep(v: number): number { return v * v * (3 - 2 * v); }
