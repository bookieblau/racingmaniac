import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  VertexBuffer,
} from "@babylonjs/core";
import { createSandTextures } from "./textures";
import {
  TERRAIN_SIZE,
  TERRAIN_SUBDIVISIONS,
  terrainHeight,
} from "./terrain";

const SAND_TILE_METERS = 6;

export function createDesertTerrain(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    "desert",
    { width: TERRAIN_SIZE, height: TERRAIN_SIZE, subdivisions: TERRAIN_SUBDIVISIONS, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) {
    throw new Error("Terrain mesh has no positions");
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

  const sandTextures = createSandTextures(scene);
  const tileRepeat = TERRAIN_SIZE / SAND_TILE_METERS;

  const sand = new StandardMaterial("sand", scene);
  sand.diffuseTexture = sandTextures.diffuse;
  sand.bumpTexture = sandTextures.bump;
  sand.diffuseColor = new Color3(1, 1, 1);
  sand.specularColor = new Color3(0.12, 0.1, 0.07);
  sand.ambientColor = new Color3(0.35, 0.28, 0.18);
  sand.bumpTexture.level = 0.38;

  sandTextures.diffuse.uScale = tileRepeat;
  sandTextures.diffuse.vScale = tileRepeat;
  sandTextures.bump.uScale = tileRepeat;
  sandTextures.bump.vScale = tileRepeat;

  ground.material = sand;
  ground.receiveShadows = true;

  return ground;
}
