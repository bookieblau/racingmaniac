import {
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { CarConfig, CarTypeId } from "./carTypes";

export interface VehicleVisualDeps {
  addWheels(
    scene: Scene,
    axleX: number,
    axleY: number,
    frontAxleZ: number,
    rearAxleZ: number,
    rimColor: Color3,
    tireColor: Color3,
  ): void;
  addBikeWheels(
    scene: Scene,
    axleY: number,
    frontAxleZ: number,
    rearAxleZ: number,
    rimColor: Color3,
    tireColor: Color3,
    rearScale?: number,
  ): void;
  createHeadlightMat(scene: Scene): StandardMaterial;
  createBrakeMat(scene: Scene): StandardMaterial;
}

export function buildVehicleVisuals(
  id: CarTypeId,
  scene: Scene,
  root: TransformNode,
  cfg: CarConfig,
  deps: VehicleVisualDeps,
): void {
  switch (id) {
    case "buggy": buildBuggy(scene, root, cfg, deps); break;
    case "monster": buildMonster(scene, root, cfg, deps); break;
    case "racer": buildRacer(scene, root, cfg, deps); break;
    case "crawler": buildCrawler(scene, root, cfg, deps); break;
    case "dirtbike": buildDirtBike(scene, root, cfg, deps); break;
    case "sportbike": buildSportBike(scene, root, cfg, deps); break;
    case "chopper": buildChopper(scene, root, cfg, deps); break;
  }
}

// ── Sand rail / VW-style buggy ──────────────────────────────────────────────

function buildBuggy(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ, axleX } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const BODY_Y = axleY + 0.22;
  const CABIN_Y = BODY_Y + 0.52;

  const paint = paintMat(scene, "buggyPaint", bodyC);
  const frame = mat(scene, "buggyFrame", new Color3(0.28, 0.28, 0.30), 0.45, undefined, 0.35);
  const seat = mat(scene, "buggySeat", new Color3(0.08, 0.08, 0.1), 0.1, undefined, 0.75);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  // Floor pan & rear engine tub (Beetle motor at back)
  attach(scene, root, "pan", 1.55, 0.12, 2.85, 0, BODY_Y, -0.05, paint);
  attach(scene, root, "engine", 1.35, 0.42, 0.95, 0, BODY_Y + 0.22, rearAxleZ + 0.35, mat(scene, "eng", new Color3(0.2, 0.2, 0.22)));
  attach(scene, root, "nose", 1.2, 0.22, 0.95, 0, BODY_Y + 0.08, frontAxleZ + 0.35, paint);

  for (const s of [-1, 1] as const) {
    attach(scene, root, `seat${s}`, 0.42, 0.12, 0.48, s * 0.38, BODY_Y + 0.18, -0.15, seat);
  }

  // Full sand-rail roll cage
  const cageH = CABIN_Y + 0.55;
  bar(scene, root, "cF",
    -axleX - 0.05, BODY_Y, frontAxleZ + 0.15,
    -axleX - 0.05, cageH, frontAxleZ + 0.15, frame);
  bar(scene, root, "cF2",
    axleX + 0.05, BODY_Y, frontAxleZ + 0.15,
    axleX + 0.05, cageH, frontAxleZ + 0.15, frame);
  bar(scene, root, "cR",
    -axleX - 0.05, BODY_Y, rearAxleZ - 0.25,
    -axleX - 0.05, cageH, rearAxleZ - 0.25, frame);
  bar(scene, root, "cR2",
    axleX + 0.05, BODY_Y, rearAxleZ - 0.25,
    axleX + 0.05, cageH, rearAxleZ - 0.25, frame);
  attach(scene, root, "cTopF", axleX * 2 + 0.2, 0.06, 0.06, 0, cageH, frontAxleZ + 0.12, frame);
  attach(scene, root, "cTopM", axleX * 2 + 0.2, 0.06, 0.06, 0, cageH, 0.05, frame);
  attach(scene, root, "cTopR", axleX * 2 + 0.2, 0.06, 0.06, 0, cageH, rearAxleZ - 0.2, frame);

  roundHeadlights(scene, root, frontAxleZ + 0.32, BODY_Y + 0.14, 0.62, hl);
  tailLights(scene, root, rearAxleZ - 0.35, BODY_Y + 0.12, 0.55, br);

  deps.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.78, 0.78, 0.78), new Color3(0.12, 0.12, 0.12));
  addCarDriver(scene, root, [0, CABIN_Y - 0.2, 0.05], [0, 0.42, 0.1], bodyC);
}

// ── Lifted pickup monster truck ─────────────────────────────────────────────

function buildMonster(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ, axleX } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const BODY_Y = axleY + 0.38;
  const CABIN_Y = BODY_Y + 0.72;

  const paint = paintMat(scene, "mtPaint", bodyC);
  const dark = mat(scene, "mtDark", bodyC.scale(0.62), 0.25, undefined, 0.4);
  const glass = mat(scene, "mtGlass", new Color3(0.25, 0.45, 0.65), 0.6, undefined, 0.06);
  const chrome = mat(scene, "mtChrome", new Color3(0.82, 0.84, 0.88), 0.75, undefined, 0.15);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  // Pickup cab (forward)
  attach(scene, root, "cab", 2.35, 0.78, 1.65, 0, CABIN_Y - 0.1, 0.45, paint);
  attach(scene, root, "roof", 2.2, 0.08, 1.55, 0, CABIN_Y + 0.44, 0.42, paint);
  attach(scene, root, "hood", 2.3, 0.28, 1.1, 0, BODY_Y + 0.52, frontAxleZ + 0.55, dark);
  attach(scene, root, "ws", 1.95, 0.52, 0.07, 0, CABIN_Y + 0.08, 1.05, glass, [-0.32, 0, 0]);
  attach(scene, root, "wsR", 1.85, 0.48, 0.07, 0, CABIN_Y + 0.06, -0.25, glass, [0.3, 0, 0]);

  // Truck bed (rear, lower)
  attach(scene, root, "bed", 2.45, 0.35, 1.85, 0, BODY_Y + 0.22, rearAxleZ + 0.15, dark);
  attach(scene, root, "tailgate", 2.42, 0.42, 0.12, 0, BODY_Y + 0.38, rearAxleZ - 0.55, paint);

  // Frame rails
  for (const s of [-1, 1] as const) {
    attach(scene, root, `rail${s}`, 0.14, 0.14, 4.2, s * 1.05, BODY_Y + 0.05, 0.1, chrome);
    attach(scene, root, `flareF${s}`, 0.22, 0.4, 1.05, s * 1.48, BODY_Y + 0.2, frontAxleZ, dark);
    attach(scene, root, `flareR${s}`, 0.22, 0.4, 1.05, s * 1.48, BODY_Y + 0.2, rearAxleZ, dark);
    const stack = attachCyl(scene, root, `exh${s}`, 0.16, 1.05, s * 1.2, CABIN_Y + 0.35, rearAxleZ + 0.35, chrome);
    stack!.rotation.x = Math.PI / 2;
  }

  roofLightBar(scene, root, CABIN_Y + 0.5, 0.5, hl);
  roundHeadlights(scene, root, frontAxleZ + 0.48, BODY_Y + 0.35, 0.95, hl, 0.36);
  tailLights(scene, root, rearAxleZ - 0.58, BODY_Y + 0.28, 0.9, br);

  deps.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.72, 0.74, 0.76), new Color3(0.1, 0.1, 0.1));
  addCarDriver(scene, root, [0, CABIN_Y - 0.05, 0.55], [0, 0.48, 0.06], bodyC);
}

// ── Trophy / Baja truck ─────────────────────────────────────────────────────

function buildRacer(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ, axleX } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const BODY_Y = axleY + 0.18;

  const paint = paintMat(scene, "rcPaint", bodyC);
  const dark = mat(scene, "rcDark", new Color3(0.14, 0.14, 0.16), 0.3, undefined, 0.45);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  attach(scene, root, "body", 1.95, 0.48, 3.75, 0, BODY_Y, -0.05, paint);
  attach(scene, root, "cab", 1.55, 0.58, 1.35, 0, BODY_Y + 0.42, -0.35, dark);
  attach(scene, root, "bed", 1.85, 0.32, 1.65, 0, BODY_Y + 0.2, rearAxleZ + 0.2, paint);

  for (const s of [-1, 1] as const) {
    attach(scene, root, `fendF${s}`, 0.5, 0.12, 0.95, s * 1.05, BODY_Y + 0.22, frontAxleZ - 0.05, paint);
    attach(scene, root, `fendR${s}`, 0.48, 0.12, 0.88, s * 1.02, BODY_Y + 0.2, rearAxleZ + 0.05, paint);
  }

  attach(scene, root, "skid", 2.05, 0.08, 0.75, 0, BODY_Y - 0.08, frontAxleZ + 0.42, dark);
  roofLightBar(scene, root, BODY_Y + 0.82, -0.2, hl, 1.4);

  // Rear trophy wing
  attach(scene, root, "wingL", 0.07, 0.42, 0.07, -0.65, BODY_Y + 0.35, rearAxleZ - 0.05, dark);
  attach(scene, root, "wingR", 0.07, 0.42, 0.07, 0.65, BODY_Y + 0.35, rearAxleZ - 0.05, dark);
  attach(scene, root, "wing", 1.45, 0.06, 0.42, 0, BODY_Y + 0.76, rearAxleZ - 0.08, dark);

  roundHeadlights(scene, root, frontAxleZ + 0.38, BODY_Y + 0.12, 0.72, hl, 0.28);
  tailLights(scene, root, rearAxleZ - 0.42, BODY_Y + 0.18, 0.68, br);

  deps.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.9, 0.88, 0.15), new Color3(0.12, 0.12, 0.12));
  addCarDriver(scene, root, [0, BODY_Y + 0.35, -0.2], [0, 0.5, 0.12], bodyC);
}

// ── Jeep-style crawler ────────────────────────────────────────────────────────

function buildCrawler(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ, axleX } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const BODY_Y = axleY + 0.36;
  const CABIN_Y = BODY_Y + 0.62;

  const paint = paintMat(scene, "crPaint", bodyC);
  const dark = mat(scene, "crDark", bodyC.scale(0.7), 0.25, undefined, 0.4);
  const glass = mat(scene, "crGlass", new Color3(0.3, 0.5, 0.62), 0.55, undefined, 0.08);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  attach(scene, root, "body", 2.05, 0.62, 2.65, 0, BODY_Y, -0.05, paint);
  attach(scene, root, "hood", 1.75, 0.14, 1.05, 0, BODY_Y + 0.4, 0.72, paint);
  attach(scene, root, "cabin", 1.95, 0.82, 1.55, 0, CABIN_Y, -0.35, paint);
  attach(scene, root, "ws", 1.65, 0.58, 0.07, 0, CABIN_Y + 0.02, 0.48, glass, [-0.12, 0, 0]);

  jeepGrille(scene, root, frontAxleZ + 0.42, BODY_Y + 0.22);

  for (const s of [-1, 1] as const) {
    roundLamp(scene, root, `hl${s}`, s * 0.68, BODY_Y + 0.18, frontAxleZ + 0.38, 0.26, hl);
    attach(scene, root, `arch${s}`, 0.22, 0.18, 0.75, s * 1.08, BODY_Y + 0.35, frontAxleZ - 0.02, dark);
  }

  // Rear spare
  const spare = attachCyl(scene, root, "spare", cfg.wheelRadius * 2.1, 0.18, 0, BODY_Y + 0.42, rearAxleZ - 0.48, dark);
  if (spare) spare.rotation.z = Math.PI / 2;

  snorkel(scene, root, 1.05, BODY_Y + 0.55, -0.05);
  roofLightBar(scene, root, CABIN_Y + 0.48, -0.35, hl, 1.1);
  tailLights(scene, root, rearAxleZ - 0.48, BODY_Y + 0.25, 0.82, br);

  deps.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.55, 0.55, 0.58), new Color3(0.11, 0.11, 0.1));
  addCarDriver(scene, root, [0, CABIN_Y - 0.05, 0.1], [0, 0.48, 0.08], bodyC);
}

// ── Motocross bike ──────────────────────────────────────────────────────────

function buildDirtBike(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const FRAME_Y = axleY + 0.48;

  const frame = mat(scene, "mxFrame", new Color3(0.15, 0.15, 0.17), 0.4, undefined, 0.4);
  const plastic = paintMat(scene, "mxPlast", bodyC);
  const seat = mat(scene, "mxSeat", new Color3(0.06, 0.06, 0.08), 0.08, undefined, 0.85);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  // Diamond frame
  bar(scene, root, "down",
    0, FRAME_Y, frontAxleZ - 0.35,
    0, FRAME_Y - 0.2, -0.08, frame);
  bar(scene, root, "up",
    0, FRAME_Y - 0.12, -0.1,
    0, FRAME_Y + 0.15, frontAxleZ - 0.2, frame);
  attachCyl(scene, root, "swing", 0.08, 0.55, 0, axleY + 0.28, rearAxleZ + 0.05, frame);

  attach(scene, root, "shroudR", 0.12, 0.42, 0.55, 0.18, FRAME_Y + 0.05, 0.05, plastic);
  attach(scene, root, "shroudL", 0.12, 0.42, 0.55, -0.18, FRAME_Y + 0.05, 0.05, plastic);
  attach(scene, root, "seat", 0.3, 0.1, 0.62, 0, FRAME_Y + 0.12, -0.22, seat);
  attach(scene, root, "fendF", 0.36, 0.05, 0.24, 0, axleY + 0.5, frontAxleZ + 0.12, plastic);
  attach(scene, root, "fendR", 0.32, 0.05, 0.42, 0, axleY + 0.46, rearAxleZ + 0.14, plastic);

  forkLegs(scene, root, axleY, frontAxleZ, frame);
  roundLamp(scene, root, "hl", 0, FRAME_Y + 0.16, frontAxleZ + 0.06, 0.18, hl);
  attach(scene, root, "tl", 0.1, 0.06, 0.05, 0, FRAME_Y + 0.08, rearAxleZ - 0.02, br);

  deps.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.75, 0.75, 0.75), new Color3(0.12, 0.11, 0.1));

  addBikeRider(scene, root,
    [0, FRAME_Y + 0.12, -0.22],
    [0, 0.38, 0.22],
    [-0.16, FRAME_Y + 0.28, frontAxleZ - 0.12], [0.16, FRAME_Y + 0.28, frontAxleZ - 0.12],
    [-0.14, axleY + 0.2, -0.05], [0.14, axleY + 0.2, -0.05],
    bodyC);
}

// ── Sport / race bike ───────────────────────────────────────────────────────

function buildSportBike(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const FRAME_Y = axleY + 0.42;

  const fair = paintMat(scene, "spFair", bodyC);
  const dark = mat(scene, "spDark", new Color3(0.08, 0.08, 0.1), 0.35, undefined, 0.5);
  const glass = mat(scene, "spGlass", new Color3(0.2, 0.35, 0.5), 0.55, undefined, 0.05);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  attach(scene, root, "frame", 0.07, 0.07, 1.55, 0, FRAME_Y - 0.1, -0.02, dark);
  attach(scene, root, "nose", 0.38, 0.35, 0.62, 0, FRAME_Y + 0.02, frontAxleZ - 0.22, fair);
  attach(scene, root, "belly", 0.34, 0.24, 0.9, 0, FRAME_Y - 0.02, -0.08, fair);
  attach(scene, root, "tail", 0.32, 0.28, 0.55, 0, FRAME_Y + 0.02, rearAxleZ + 0.06, fair);
  attach(scene, root, "ws", 0.32, 0.38, 0.05, 0, FRAME_Y + 0.22, frontAxleZ - 0.08, glass, [-0.4, 0, 0]);

  for (const s of [-1, 1] as const) {
    attach(scene, root, `cowL${s}`, 0.05, 0.38, 0.72, s * 0.2, FRAME_Y - 0.05, -0.05, fair);
    attach(scene, root, `exh${s}`, 0.08, 0.08, 0.55, s * 0.14, axleY + 0.16, rearAxleZ + 0.15, dark);
  }

  forkLegs(scene, root, axleY, frontAxleZ, dark);
  attach(scene, root, "hbar", 0.52, 0.05, 0.05, 0, FRAME_Y + 0.18, frontAxleZ - 0.14, dark);
  roundLamp(scene, root, "hl", 0, FRAME_Y + 0.08, frontAxleZ + 0.02, 0.14, hl);
  attach(scene, root, "tl", 0.1, 0.05, 0.05, 0, FRAME_Y + 0.05, rearAxleZ - 0.04, br);

  deps.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
    new Color3(0.9, 0.88, 0.2), new Color3(0.1, 0.1, 0.1));

  addBikeRider(scene, root,
    [0, FRAME_Y + 0.1, -0.28],
    [0, 0.26, 0.34],
    [-0.15, FRAME_Y + 0.18, frontAxleZ - 0.14], [0.15, FRAME_Y + 0.18, frontAxleZ - 0.14],
    [-0.13, axleY + 0.24, rearAxleZ + 0.18], [0.13, axleY + 0.24, rearAxleZ + 0.18],
    bodyC);
}

// ── Chopper / cruiser ───────────────────────────────────────────────────────

function buildChopper(scene: Scene, root: TransformNode, cfg: CarConfig, deps: VehicleVisualDeps): void {
  const { axleY, frontAxleZ, rearAxleZ, wheelRadius: wr } = cfg;
  const bodyC = hex(cfg.bodyColorHex);
  const FRAME_Y = axleY + 0.55;

  const chrome = mat(scene, "chChrome", new Color3(0.85, 0.86, 0.9), 0.8, undefined, 0.12);
  const paint = paintMat(scene, "chPaint", bodyC);
  const leather = mat(scene, "chSeat", new Color3(0.12, 0.06, 0.04), 0.12, undefined, 0.8);
  const hl = deps.createHeadlightMat(scene);
  const br = deps.createBrakeMat(scene);

  attach(scene, root, "frame", 0.11, 0.11, 2.1, 0, FRAME_Y - 0.2, -0.05, chrome);

  const tank = MeshBuilder.CreateSphere("tank", { diameter: 0.42, segments: 12 }, scene);
  tank.scaling.set(1.15, 0.72, 1.45);
  tank.position.set(0, FRAME_Y + 0.06, 0.08);
  tank.parent = root;
  tank.material = paint;

  attach(scene, root, "seat", 0.42, 0.1, 0.55, 0, FRAME_Y + 0.14, -0.32, leather);
  sissyBar(scene, root, FRAME_Y, rearAxleZ, chrome);

  for (const s of [-1, 1] as const) {
    attachCyl(scene, root, `fork${s}`, 0.07, 0.92, s * 0.11, FRAME_Y + 0.25, frontAxleZ - 0.18, chrome);
    attach(scene, root, `exh${s}`, 0.09, 0.09, 0.9, s * 0.2, axleY + 0.2, rearAxleZ + 0.22, chrome);
    attach(scene, root, `hbar${s}`, 0.06, 0.24, 0.06, s * 0.34, FRAME_Y + 0.5, -0.06, chrome);
  }

  const headl = attachCyl(scene, root, "hl", 0.27, 0.11, 0, FRAME_Y + 0.2, frontAxleZ + 0.08, chrome);
  if (headl) {
    headl.rotation.x = Math.PI / 2;
    headl.material = hl;
  }
  attach(scene, root, "tl", 0.12, 0.08, 0.05, 0, FRAME_Y + 0.1, rearAxleZ - 0.05, br);

  deps.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
    chrome.diffuseColor, new Color3(0.1, 0.1, 0.1), wr * 1.2);

  addBikeRider(scene, root,
    [0, FRAME_Y + 0.16, -0.28],
    [0, 0.28, 0.04],
    [-0.36, FRAME_Y + 0.48, -0.06], [0.36, FRAME_Y + 0.48, -0.06],
    [-0.13, axleY + 0.14, -0.04], [0.13, axleY + 0.14, -0.04],
    bodyC);
}

// ── Detail helpers ──────────────────────────────────────────────────────────

function bar(
  scene: Scene, root: TransformNode, name: string,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  material: StandardMaterial,
): void {
  limbBox(scene, root, name, [x1, y1, z1], [x2, y2, z2], 0.055, material);
}

function roundHeadlights(
  scene: Scene, root: TransformNode, z: number, y: number, spread: number,
  matHl: StandardMaterial, size = 0.24,
): void {
  for (const s of [-1, 1] as const) {
    roundLamp(scene, root, `hlp${s}`, s * spread, y, z, size, matHl);
  }
}

function roundLamp(
  scene: Scene, root: TransformNode, name: string,
  x: number, y: number, z: number, diameter: number, material: StandardMaterial,
): void {
  const m = MeshBuilder.CreateSphere(name, { diameter, segments: 14 }, scene);
  m.position.set(x, y, z);
  m.parent = root;
  m.material = material;
}

function tailLights(
  scene: Scene, root: TransformNode, z: number, y: number, spread: number,
  material: StandardMaterial,
): void {
  for (const s of [-1, 1] as const) {
    attach(scene, root, `tl${s}`, 0.2, 0.14, 0.06, s * spread, y, z, material);
  }
}

function roofLightBar(
  scene: Scene, root: TransformNode, y: number, z: number,
  hl: StandardMaterial, width = 1.2,
): void {
  const barM = mat(scene, "lightBar", new Color3(0.12, 0.12, 0.14), 0.4, undefined, 0.5);
  attach(scene, root, "lbar", width, 0.07, 0.08, 0, y, z, barM);
  for (let i = -2; i <= 2; i++) {
    roundLamp(scene, root, `lamp${i}`, (i * width) / 5, y + 0.06, z, 0.12, hl);
  }
}

function jeepGrille(scene: Scene, root: TransformNode, z: number, y: number): void {
  const slat = mat(scene, "grille", new Color3(0.12, 0.12, 0.13), 0.2, undefined, 0.55);
  for (let i = -3; i <= 3; i++) {
    attach(scene, root, `g${i}`, 0.05, 0.22, 0.06, i * 0.11, y, z, slat);
  }
}

function snorkel(scene: Scene, root: TransformNode, x: number, y: number, z: number): void {
  const m = mat(scene, "snork", new Color3(0.2, 0.2, 0.22), 0.35, undefined, 0.4);
  attachCyl(scene, root, "snork", 0.1, 0.75, x, y, z, m);
}

function forkLegs(scene: Scene, root: TransformNode, axleY: number, frontZ: number, material: StandardMaterial): void {
  for (const s of [-1, 1] as const) {
    attach(scene, root, `fork${s}`, 0.05, 0.48, 0.05, s * 0.09, axleY + 0.38, frontZ - 0.06, material);
  }
}

function sissyBar(scene: Scene, root: TransformNode, frameY: number, rearZ: number, material: StandardMaterial): void {
  bar(scene, root, "sisL", -0.2, frameY + 0.1, rearZ + 0.15, -0.2, frameY + 0.55, rearZ + 0.18, material);
  bar(scene, root, "sisR", 0.2, frameY + 0.1, rearZ + 0.15, 0.2, frameY + 0.55, rearZ + 0.18, material);
  attach(scene, root, "sisTop", 0.44, 0.06, 0.06, 0, frameY + 0.55, rearZ + 0.18, material);
}

function attach(
  scene: Scene, root: TransformNode, name: string,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  material: StandardMaterial,
  rotation?: [number, number, number],
): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  if (rotation) [m.rotation.x, m.rotation.y, m.rotation.z] = rotation;
  m.parent = root;
  m.material = material;
  m.isPickable = false;
  return m;
}

function attachCyl(
  scene: Scene, root: TransformNode, name: string,
  diameter: number, height: number,
  x: number, y: number, z: number,
  material: StandardMaterial,
): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 12 }, scene);
  m.position.set(x, y, z);
  m.parent = root;
  m.material = material;
  m.isPickable = false;
  return m;
}

function mat(
  scene: Scene, name: string, diffuse: Color3,
  specularStrength = 0.15, emissive?: Color3, roughness = 0.5,
): StandardMaterial {
  const m = new StandardMaterial(`v_${name}_${Math.random().toString(36).slice(2, 5)}`, scene);
  m.diffuseColor = diffuse;
  m.specularColor = new Color3(specularStrength, specularStrength, specularStrength);
  m.specularPower = 8 + (1 - roughness) * 96;
  m.ambientColor = diffuse.scale(0.32);
  if (emissive) m.emissiveColor = emissive;
  return m;
}

function paintMat(scene: Scene, name: string, color: Color3): StandardMaterial {
  return mat(scene, name, color, 0.42, undefined, 0.28);
}

function hex(h: string): Color3 {
  return new Color3(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );
}

type Point = readonly [number, number, number];
const RIDER_SUIT = new Color3(0.15, 0.17, 0.21);
const RIDER_VISOR = new Color3(0.04, 0.04, 0.05);

function addCarDriver(scene: Scene, root: TransformNode, hip: Point, lean: Point, helmetColor: Color3): void {
  const suit = mat(scene, "drvSuit", RIDER_SUIT, 0.12);
  const helmet = mat(scene, "drvHelm", helmetColor, 0.6);
  const visor = mat(scene, "drvVis", RIDER_VISOR, 0.7);
  const shoulder: Point = [hip[0] + lean[0], hip[1] + lean[1], hip[2] + lean[2]];
  limbBox(scene, root, "torso", hip, shoulder, 0.24, suit);
  riderHead(scene, root, shoulder, lean, suit, helmet, visor);
}

function addBikeRider(
  scene: Scene, root: TransformNode,
  hip: Point, lean: Point, handL: Point, handR: Point, footL: Point, footR: Point,
  helmetColor: Color3,
): void {
  const suit = mat(scene, "rSuit", RIDER_SUIT, 0.12);
  const helmet = mat(scene, "rHelm", helmetColor, 0.6);
  const visor = mat(scene, "rVis", RIDER_VISOR, 0.7);
  const shoulder: Point = [hip[0] + lean[0], hip[1] + lean[1], hip[2] + lean[2]];
  limbBox(scene, root, "torso", hip, shoulder, 0.24, suit);
  riderHead(scene, root, shoulder, lean, suit, helmet, visor);
  limbBox(scene, root, "armL", [shoulder[0] - 0.12, shoulder[1], shoulder[2]], handL, 0.09, suit);
  limbBox(scene, root, "armR", [shoulder[0] + 0.12, shoulder[1], shoulder[2]], handR, 0.09, suit);
  limbBox(scene, root, "legL", [hip[0] - 0.09, hip[1], hip[2]], footL, 0.12, suit);
  limbBox(scene, root, "legR", [hip[0] + 0.09, hip[1], hip[2]], footR, 0.12, suit);
}

function riderHead(
  scene: Scene, root: TransformNode, shoulder: Point, lean: Point,
  suit: StandardMaterial, helmet: StandardMaterial, visor: StandardMaterial,
): void {
  const dir = new Vector3(...lean).normalize();
  const head = new Vector3(...shoulder).add(dir.scale(0.17));
  const skull = MeshBuilder.CreateSphere("head", { diameter: 0.24, segments: 10 }, scene);
  skull.position.copyFrom(head);
  skull.parent = root;
  skull.material = suit;
  const helm = MeshBuilder.CreateSphere("helmet", { diameter: 0.28, segments: 10 }, scene);
  helm.position.copyFrom(head);
  helm.parent = root;
  helm.material = helmet;
  attach(scene, root, "visor", 0.18, 0.08, 0.05, head.x, head.y - 0.02, head.z + 0.12, visor);
}

function limbBox(
  scene: Scene, root: TransformNode, name: string,
  from: Point, to: Point, thickness: number, material: StandardMaterial,
): Mesh {
  const fromV = new Vector3(...from);
  const toV = new Vector3(...to);
  const dir = toV.subtract(fromV);
  const length = Math.max(0.05, dir.length());
  const box = MeshBuilder.CreateBox(name, { width: thickness, height: length, depth: thickness }, scene);
  box.position = fromV.add(toV).scale(0.5);
  box.parent = root;
  box.material = material;
  box.isPickable = false;
  box.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
    Vector3.Up(), dir.normalize(), new Quaternion(),
  );
  return box;
}
