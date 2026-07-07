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
  CITY_BLOCK,
  CITY_ROAD,
  TERRAIN_SIZE,
  TERRAIN_SUBDIVISIONS,
  terrainHeight,
} from "./cityTerrain";

const TILE_METERS = 8;

export function createCityTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "cityGround",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) throw new Error("City terrain has no positions");

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const z = positions[i + 2]!;
    positions[i + 1] = terrainHeight(x, z);
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  ground.refreshBoundingInfo(true);

  const asphaltTex = createAsphaltTexture(scene);
  const tileRepeat = TERRAIN_SIZE / TILE_METERS;
  asphaltTex.uScale = tileRepeat;
  asphaltTex.vScale = tileRepeat;

  const mat = new StandardMaterial("cityGroundMat", scene);
  mat.diffuseTexture = asphaltTex;
  mat.diffuseColor = new Color3(0.92, 0.92, 0.92);
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.ambientColor = new Color3(0.25, 0.25, 0.28);

  ground.material = mat;
  ground.receiveShadows = true;
  return ground;
}

function createAsphaltTexture(scene: Scene): DynamicTexture {
  const SIZE = 256;
  const tex = new DynamicTexture("asphaltTex", { width: SIZE, height: SIZE }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  // Sidewalk / lot base
  ctx.fillStyle = "#8a8a88";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Fine asphalt grain
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const g = 70 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgba(${g},${g},${g + 2},0.35)`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Road grid aligned to CITY_BLOCK / CITY_ROAD ratio within tile
  const roadPx = Math.round((CITY_ROAD / CITY_BLOCK) * SIZE);
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(0, 0, roadPx, SIZE);
  ctx.fillRect(0, 0, SIZE, roadPx);

  // Lane dashes along horizontal roads
  ctx.fillStyle = "#d8d060";
  const dashW = 10;
  const dashH = 3;
  const gap = 16;
  for (let x = roadPx + 6; x < SIZE; x += dashW + gap) {
    ctx.fillRect(x, roadPx / 2 - dashH / 2, dashW, dashH);
  }
  for (let y = roadPx + 6; y < SIZE; y += dashW + gap) {
    ctx.fillRect(roadPx / 2 - dashH / 2, y, dashH, dashW);
  }

  tex.update(false);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}
