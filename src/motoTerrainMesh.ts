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
  distToTrack,
  MOTO_TRACK_RADIUS,
  TERRAIN_SIZE,
  TERRAIN_SUBDIVISIONS,
  terrainHeight,
} from "./motoTerrain";

export function createMotoTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "motoTrack",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    throw new Error("Moto terrain mesh has no positions");
  }

  // CreateGround already centers at origin: X,Z ∈ [-TERRAIN_SIZE/2, TERRAIN_SIZE/2]
  // Use them directly — they are world coordinates and must match terrainHeight().
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const dirtTextures = createMotoDirtTextures(scene);

  const mat = new StandardMaterial("motoDirt", scene);
  mat.diffuseTexture = dirtTextures.diffuse;
  mat.bumpTexture = dirtTextures.bump;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.1, 0.09, 0.07);
  mat.specularPower = 64;
  mat.ambientColor = new Color3(0.34, 0.26, 0.18);
  mat.bumpTexture.level = 0.42;
  mat.useSpecularOverAlpha = true;

  ground.material = mat;
  ground.receiveShadows = true;

  return ground;
}

// ── Dirt surface texture ──────────────────────────────────────────────────────
// One texture mapped 1:1 over the whole terrain footprint (no tiling) so the
// worn racing groove down the middle of the track and the raw desert beyond
// its edges both land in the right place. Real motocross dirt: warm reddish
// loam on the groomed track, dusty pale scrub just past the berms.

const TEX_SIZE = 1024;

function createMotoDirtTextures(scene: Scene) {
  const diffuse = new DynamicTexture("motoDirtDiffuse", TEX_SIZE, scene, false);
  const bump = new DynamicTexture("motoDirtBump", TEX_SIZE, scene, false);

  const dCanvas = document.createElement("canvas");
  const bCanvas = document.createElement("canvas");
  dCanvas.width = bCanvas.width = TEX_SIZE;
  dCanvas.height = bCanvas.height = TEX_SIZE;

  const dCtx = dCanvas.getContext("2d");
  const bCtx = bCanvas.getContext("2d");
  if (!dCtx || !bCtx) throw new Error("Unable to create moto dirt texture canvas");

  const dImage = dCtx.createImageData(TEX_SIZE, TEX_SIZE);
  const bImage = bCtx.createImageData(TEX_SIZE, TEX_SIZE);
  const half = TERRAIN_SIZE / 2;

  for (let py = 0; py < TEX_SIZE; py++) {
    for (let px = 0; px < TEX_SIZE; px++) {
      // CreateGround's default UVs run 0→1 across X and Z with V flipped
      // relative to the Z axis, so mirror py to line the texture up correctly.
      const wx = (px / TEX_SIZE) * TERRAIN_SIZE - half;
      const wz = ((TEX_SIZE - 1 - py) / TEX_SIZE) * TERRAIN_SIZE - half;

      const grain = fbm(wx * 0.09, wz * 0.09);
      const fleck = fbm(wx * 0.35 + 40, wz * 0.35 + 40);
      const d = distToTrack(wx, wz);
      const offTrack = smoothstep((d - MOTO_TRACK_RADIUS - 1) / 14);

      // Base loam colour with grain variation — deep reddish brown.
      let r = lerp(118, 148, grain) + fleck * 10;
      let g = lerp(62, 82, grain) + fleck * 6;
      let b = lerp(38, 52, grain) + fleck * 4;

      // Worn racing line: darkest right on the centreline, fading out by the
      // berm crest.
      const groove = 1 - smoothstep(Math.min(d / (MOTO_TRACK_RADIUS * 0.55), 1));
      r = lerp(r, r * 0.62, groove);
      g = lerp(g, g * 0.6, groove);
      b = lerp(b, b * 0.58, groove);

      // Dry dust kicked up right at the berm crest — a lighter, sandier band.
      const crestDist = Math.abs(d - MOTO_TRACK_RADIUS * 0.82);
      const dust = Math.max(0, 1 - crestDist / 6);
      r = lerp(r, 188, dust * 0.35);
      g = lerp(g, 150, dust * 0.35);
      b = lerp(b, 108, dust * 0.35);

      // Infield grass past the berms — MX venue, not open desert.
      r = lerp(r, lerp(72, 58, grain), offTrack);
      g = lerp(g, lerp(118, 94, grain), offTrack);
      b = lerp(b, lerp(42, 36, grain), offTrack);

      const rut = groove * groove;
      r = lerp(r, r * 0.55, rut * 0.4);
      g = lerp(g, g * 0.52, rut * 0.4);
      b = lerp(b, b * 0.5, rut * 0.4);

      const idx = (py * TEX_SIZE + px) * 4;
      dImage.data[idx] = clampByte(r);
      dImage.data[idx + 1] = clampByte(g);
      dImage.data[idx + 2] = clampByte(b);
      dImage.data[idx + 3] = 255;

      // Fine grain bump only — kept subtle so it reads as packed dirt, not a
      // dimpled surface.
      const bumpVal = clamp01(0.5 + grain * 0.1 + fleck * 0.04);
      const bByte = Math.floor(bumpVal * 255);
      bImage.data[idx] = bByte;
      bImage.data[idx + 1] = bByte;
      bImage.data[idx + 2] = bByte;
      bImage.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImage, 0, 0);
  bCtx.putImageData(bImage, 0, 0);
  diffuse.getContext().drawImage(dCanvas, 0, 0);
  bump.getContext().drawImage(bCanvas, 0, 0);
  diffuse.update(false);
  bump.update(false);

  diffuse.wrapU = bump.wrapU = Texture.CLAMP_ADDRESSMODE;
  diffuse.wrapV = bump.wrapV = Texture.CLAMP_ADDRESSMODE;

  return { diffuse, bump };
}

function fbm(x: number, z: number): number {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2.6, z * 2.6) * 0.3 + valueNoise(x * 5.4, z * 5.4) * 0.1;
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

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
