import { Color3, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import { ObstacleField } from "../obstacles";
import {
  MOTO_CHECKPOINTS,
  MOTO_LOOP,
  MOTO_RAMPS,
  MOTO_SPAWN,
  MOTO_TRACK_RADIUS,
  terrainHeight,
} from "../motoTerrain";
import { configureMotoAtmosphere } from "../lighting";
import { createWorldSky } from "../sky";
import { createMotoTerrain } from "../motoTerrainMesh";

export function setupMotoWorld(scene: Scene): ObstacleField {
  configureMotoAtmosphere(scene);
  createWorldSky(scene, "moto");
  createMotoTerrain(scene);
  createFarBacking(scene);
  placeStartGate(scene);
  placeCheckpointMarkers(scene);
  placeJumpMarkers(scene);
  placeTrackBoundary(scene);
  placeVenueFencing(scene);
  placeGrandstands(scene);
  placeSponsorBanners(scene);
  return ObstacleField.empty();
}

/** MX venue — brown loam track, green infield. */
export const MOTO_HEMI_GROUND = new Color3(0.32, 0.44, 0.24);
export const MOTO_HEMI_DIFFUSE = new Color3(0.82, 0.9, 0.76);
export const MOTO_SUN_DIFFUSE = new Color3(1, 0.94, 0.78);
export const MOTO_SUN_SPECULAR = new Color3(0.9, 0.85, 0.7);

const FAR_FLOOR = -3;

function createFarBacking(scene: Scene): void {
  const plane = MeshBuilder.CreateGround("motoFarGround", { width: 2100, height: 2100 }, scene);
  plane.position.y = FAR_FLOOR;
  plane.isPickable = false;

  const mat = new StandardMaterial("motoFarGroundMat", scene);
  mat.diffuseColor = new Color3(0.38, 0.52, 0.28);
  mat.specularColor = new Color3(0.02, 0.02, 0.02);
  plane.material = mat;
}

function placeStartGate(scene: Scene): void {
  const y = terrainHeight(MOTO_SPAWN.x, MOTO_SPAWN.z);
  const gateW = 12 * (MOTO_TRACK_RADIUS / 34);
  const postMat = new StandardMaterial("motoStartPost", scene);
  postMat.diffuseColor = new Color3(0.75, 0.75, 0.78);
  postMat.specularColor = new Color3(0.35, 0.35, 0.38);

  const bannerMat = new StandardMaterial("motoStartBanner", scene);
  bannerMat.diffuseColor = new Color3(0.14, 0.42, 0.18);
  bannerMat.specularColor = Color3.Black();

  const gateMat = new StandardMaterial("motoGatePlate", scene);
  gateMat.diffuseColor = new Color3(0.88, 0.88, 0.9);
  gateMat.specularColor = new Color3(0.25, 0.25, 0.28);

  for (const side of [-1, 1]) {
    const post = MeshBuilder.CreateBox(
      `motoStartPost${side}`,
      { width: 0.28, height: 3.6, depth: 0.28 },
      scene,
    );
    post.position.set(MOTO_SPAWN.x + side * gateW, y + 1.8, MOTO_SPAWN.z);
    post.material = postMat;
    post.isPickable = false;
  }

  const banner = MeshBuilder.CreateBox(
    "motoStartBanner", { width: gateW * 2 + 0.4, height: 0.75, depth: 0.08 }, scene,
  );
  banner.position.set(MOTO_SPAWN.x, y + 3.45, MOTO_SPAWN.z);
  banner.material = bannerMat;
  banner.isPickable = false;

  const plates = 7;
  const plateW = (gateW * 2) / plates;
  for (let i = 0; i < plates; i++) {
    const plate = MeshBuilder.CreateBox(
      `motoGatePlate${i}`,
      { width: plateW * 0.88, height: 1.15, depth: 0.06 },
      scene,
    );
    plate.position.set(
      MOTO_SPAWN.x - gateW + plateW * 0.5 + i * plateW,
      y + 0.95,
      MOTO_SPAWN.z,
    );
    plate.rotation.x = -0.12;
    plate.material = gateMat;
    plate.isPickable = false;
  }
}

function placeCheckpointMarkers(scene: Scene): void {
  const postMat = new StandardMaterial("motoCpPost", scene);
  postMat.diffuseColor = new Color3(0.95, 0.82, 0.08);
  postMat.specularColor = new Color3(0.1, 0.08, 0.04);

  const flagMat = new StandardMaterial("motoCpFlag", scene);
  flagMat.diffuseColor = new Color3(0.92, 0.2, 0.14);
  flagMat.specularColor = new Color3(0.1, 0.05, 0.05);

  MOTO_CHECKPOINTS.forEach((cp, i) => {
    if (i === MOTO_CHECKPOINTS.length - 1) return; // shares the start/finish gate

    const y = terrainHeight(cp.x, cp.z);

    const post = MeshBuilder.CreateCylinder(
      `motoCpPost${i}`,
      { diameter: 0.24, height: 3.2, tessellation: 6 },
      scene,
    );
    post.position.set(cp.x, y + 1.6, cp.z);
    post.material = postMat;
    post.isPickable = false;

    const flag = MeshBuilder.CreateBox(`motoCpFlag${i}`, { width: 1.4, height: 0.55, depth: 0.05 }, scene);
    flag.position.set(cp.x + 0.75, y + 2.9, cp.z);
    flag.material = flagMat;
    flag.isPickable = false;
  });
}

function placeJumpMarkers(scene: Scene): void {
  const coneColors: Record<string, Color3> = {
    single: new Color3(0.92, 0.42, 0.08),
    tabletop: new Color3(0.15, 0.55, 0.92),
    stepup: new Color3(0.92, 0.82, 0.12),
    double: new Color3(0.88, 0.18, 0.2),
    gap: new Color3(0.2, 0.85, 0.55),
  };

  for (let i = 0; i < MOTO_RAMPS.length; i++) {
    const ramp = MOTO_RAMPS[i]!;
    const coneMat = new StandardMaterial(`motoCone${i}`, scene);
    coneMat.diffuseColor = coneColors[ramp.kind] ?? coneColors.single;
    coneMat.specularColor = new Color3(0.1, 0.05, 0.02);
    const sin = Math.sin(ramp.heading);
    const cos = Math.cos(ramp.heading);

    for (const side of [-1, 1]) {
      const lx = -ramp.approach * 0.55;
      const ly = side * (ramp.width / 2 + 2.5);
      const x = ramp.cx + lx * cos + ly * sin;
      const z = ramp.cz - lx * sin + ly * cos;
      const y = terrainHeight(x, z);

      const cone = MeshBuilder.CreateCylinder(
        `motoCone${i}_${side}`,
        { diameterTop: 0.05, diameterBottom: 0.9, height: 1.1, tessellation: 10 },
        scene,
      );
      cone.position.set(x, y + 0.55, z);
      cone.material = coneMat;
      cone.isPickable = false;
    }
  }
}

// Alternating white/orange "tuff block" markers run continuously around both
// sides of the whole loop, right on the berm crest — the classic way a real
// motocross track marks its edges.
function placeTrackBoundary(scene: Scene): void {
  // InstancedMesh always shares its source mesh's material, so alternating
  // colours needs two separate prototypes (one per colour), not one prototype
  // with the material swapped per instance.
  const protoSize = { width: 1.0, height: 0.55, depth: 0.55 };
  const whiteProto = MeshBuilder.CreateBox("motoTuffWhiteProto", protoSize, scene);
  whiteProto.material = makeMat(scene, "motoTuffWhite", new Color3(0.92, 0.92, 0.88));
  whiteProto.isVisible = false;

  const orangeProto = MeshBuilder.CreateBox("motoTuffOrangeProto", protoSize, scene);
  orangeProto.material = makeMat(scene, "motoTuffOrange", new Color3(0.9, 0.4, 0.05));
  orangeProto.isVisible = false;

  const SPACING = 6;
  const OFFSET = MOTO_TRACK_RADIUS + 2;
  let blockIdx = 0;

  for (let i = 0; i < MOTO_LOOP.length; i++) {
    const a = MOTO_LOOP[i]!;
    const b = MOTO_LOOP[(i + 1) % MOTO_LOOP.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const dirX = dx / len;
    const dirZ = dz / len;
    const perpX = dirZ;
    const perpZ = -dirX;
    const yaw = Math.atan2(dirX, dirZ);

    const steps = Math.max(1, Math.round(len / SPACING));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const proto = (i * 1000 + s) % 2 === 0 ? whiteProto : orangeProto;

      for (const side of [-1, 1]) {
        const bx = px + perpX * OFFSET * side;
        const bz = pz + perpZ * OFFSET * side;
        const by = terrainHeight(bx, bz);

        const block = proto.createInstance(`motoTuff${blockIdx}`);
        block.position.set(bx, by + 0.3, bz);
        block.rotation.y = yaw;
        block.isPickable = false;
        blockIdx++;
      }
    }
  }
}

function makeMat(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.06, 0.06, 0.06);
  return m;
}

/** Cable fence and posts along the spectator side of long straights. */
function placeVenueFencing(scene: Scene): void {
  const postMat = makeMat(scene, "motoFencePost", new Color3(0.55, 0.55, 0.58));
  const cableMat = makeMat(scene, "motoFenceCable", new Color3(0.35, 0.35, 0.38));
  // Skip segment 2 (Turn 1 / east straight) — fence posts sat on the racing line.
  const straightSegs = [0, 4, 6];
  const offset = MOTO_TRACK_RADIUS + 7;
  const spacing = 10 * (MOTO_TRACK_RADIUS / 34);

  for (const i of straightSegs) {
    const a = MOTO_LOOP[i]!;
    const b = MOTO_LOOP[(i + 1) % MOTO_LOOP.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const dirX = dx / len;
    const dirZ = dz / len;
    const perpX = dirZ;
    const perpZ = -dirX;
    const steps = Math.max(2, Math.floor(len / spacing));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const bx = px + perpX * offset;
      const bz = pz + perpZ * offset;
      const by = terrainHeight(bx, bz);

      const post = MeshBuilder.CreateCylinder(
        `motoFence${i}_${s}`,
        { diameter: 0.14, height: 2.2, tessellation: 6 },
        scene,
      );
      post.position.set(bx, by + 1.1, bz);
      post.material = postMat;
      post.isPickable = false;

      if (s < steps) {
        const t2 = (s + 0.5) / steps;
        const px2 = a.x + dx * t2 + perpX * offset;
        const pz2 = a.z + dz * t2 + perpZ * offset;
        const by2 = terrainHeight(px2, pz2) + 1.65;
        const cable = MeshBuilder.CreateBox(
          `motoCable${i}_${s}`,
          { width: spacing * 1.02, height: 0.05, depth: 0.05 },
          scene,
        );
        cable.position.set(px2, by2, pz2);
        cable.rotation.y = Math.atan2(dirX, dirZ);
        cable.material = cableMat;
        cable.isPickable = false;
      }
    }
  }
}

/** Bleachers along the main straight (spectator side). */
function placeGrandstands(scene: Scene): void {
  const seg = 0;
  const a = MOTO_LOOP[seg]!;
  const b = MOTO_LOOP[(seg + 1) % MOTO_LOOP.length]!;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const dirX = dx / len;
  const dirZ = dz / len;
  const perpX = dirZ;
  const perpZ = -dirX;
  const offset = MOTO_TRACK_RADIUS + 16;
  const standMat = makeMat(scene, "motoStandSeat", new Color3(0.42, 0.44, 0.48));
  const railMat = makeMat(scene, "motoStandRail", new Color3(0.72, 0.74, 0.78));

  for (let tier = 0; tier < 4; tier++) {
    const t0 = 0.12 + tier * 0.04;
    const t1 = 0.88 - tier * 0.04;
    const px = a.x + dx * ((t0 + t1) * 0.5);
    const pz = a.z + dz * ((t0 + t1) * 0.5);
    const sx = px + perpX * offset;
    const sz = pz + perpZ * offset;
    const sy = terrainHeight(sx, sz);
    const span = len * (t1 - t0) * 0.92;
    const yaw = Math.atan2(dirX, dirZ);

    const stand = MeshBuilder.CreateBox(
      `motoStand${tier}`,
      { width: span, height: 0.35 + tier * 0.32, depth: 2.4 + tier * 0.35 },
      scene,
    );
    stand.position.set(sx, sy + 0.2 + tier * 0.32, sz);
    stand.rotation.y = yaw;
    stand.material = standMat;
    stand.isPickable = false;

    const rail = MeshBuilder.CreateBox(
      `motoStandRail${tier}`,
      { width: span * 0.98, height: 0.08, depth: 0.12 },
      scene,
    );
    rail.position.set(sx, sy + 1.1 + tier * 0.45, sz - 1.1);
    rail.rotation.y = yaw;
    rail.material = railMat;
    rail.isPickable = false;
  }
}

/** Pit lane / sponsor boards on straights. */
function placeSponsorBanners(scene: Scene): void {
  const bannerMat = makeMat(scene, "motoSponsor", new Color3(0.12, 0.38, 0.22));
  const accentMat = makeMat(scene, "motoSponsorAccent", new Color3(0.9, 0.22, 0.14));
  const straights = [0, 3, 6, 8];

  for (const seg of straights) {
    const a = MOTO_LOOP[seg]!;
    const b = MOTO_LOOP[(seg + 1) % MOTO_LOOP.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) continue;
    const dirX = dx / len;
    const dirZ = dz / len;
    const perpX = -dirZ;
    const perpZ = dirX;
    const offset = MOTO_TRACK_RADIUS + 5.5;
    const t = 0.42;
    const px = a.x + dx * t + perpX * offset;
    const pz = a.z + dz * t + perpZ * offset;
    const py = terrainHeight(px, pz);

    const board = MeshBuilder.CreateBox(
      `motoBanner${seg}`,
      { width: 8, height: 1.4, depth: 0.12 },
      scene,
    );
    board.position.set(px, py + 1.6, pz);
    board.rotation.y = Math.atan2(perpX, perpZ);
    board.material = seg % 2 === 0 ? bannerMat : accentMat;
    board.isPickable = false;
  }
}
