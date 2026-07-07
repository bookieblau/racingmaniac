import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";
import {
  CHALLENGE_HILL_X,
  CHALLENGE_HILL_Z,
  CHALLENGE_HILL_RADIUS,
  DESERT_FLOOR,
  TERRAIN_SIZE,
  terrainHeight,
} from "./terrain";

// ── Seeded pseudo-random (same world every load) ─────────────────────────────

function makeRng(seed: number) {
  let s = seed;
  return function (): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Materials ─────────────────────────────────────────────────────────────────

function lightRockColor(rng: () => number): Color3 {
  const v = 0.26 + rng() * 0.10;   // 0.26–0.36: dark gray with warm brown tint
  return new Color3(v * 1.08, v, v * 0.88);
}

function darkRockColor(rng: () => number): Color3 {
  const v = 0.13 + rng() * 0.09;   // 0.13–0.22: very dark brownish gray
  return new Color3(v * 1.10, v, v * 0.85);
}

function makeMat(scene: Scene, name: string, color: Color3, specular = 0.06): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(specular, specular, specular);
  return m;
}

// ── Far-ground backing plane ──────────────────────────────────────────────────
// A large flat plane that extends well beyond the playable terrain mesh so
// that distant mesa bases have ground to sit on and don't appear to float.

export function createFarGround(scene: Scene): void {
  const plane = MeshBuilder.CreateGround(
    "farGround",
    { width: 1400, height: 1400 },
    scene,
  );
  // 2 cm below the terrain's DESERT_FLOOR so z-fighting can't occur
  // where the flat valley floor meets this backing plane.
  plane.position.y = DESERT_FLOOR - 0.02;
  plane.isPickable = false;

  const m = new StandardMaterial("farGroundMat", scene);
  m.diffuseColor  = new Color3(0.60, 0.48, 0.33);
  m.specularColor = new Color3(0.02, 0.02, 0.02);
  plane.material = m;
}

// ── Rocks ─────────────────────────────────────────────────────────────────────

const ROCK_COUNT = 110;
const ROCK_EXCLUSION = 14; // keep centre clear so car doesn't start buried

export function placeRocks(scene: Scene): void {
  const rng = makeRng(42);

  const baseSphere = MeshBuilder.CreateSphere(
    "rockBase",
    { diameter: 1, segments: 5 },
    scene,
  );
  baseSphere.isVisible = false;

  const half = TERRAIN_SIZE / 2 - 4;

  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;

    if (Math.abs(x) < ROCK_EXCLUSION && Math.abs(z) < ROCK_EXCLUSION) {
      continue;
    }

    const y = terrainHeight(x, z);
    const sizeW = 0.5 + rng() * 2.8;
    const sizeH = sizeW * (0.4 + rng() * 0.55);
    const sizeD = sizeW * (0.55 + rng() * 0.6);

    const rock = baseSphere.createInstance(`rock_${i}`);
    rock.scaling.set(sizeW, sizeH, sizeD);
    rock.position.set(x, y + sizeH * 0.35, z);
    rock.rotation.set(rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI * 0.5);
    rock.isPickable = false;

    const mat = makeMat(
      scene,
      `rockMat_${i}`,
      i % 3 === 0 ? darkRockColor(rng) : lightRockColor(rng),
      0.0,   // matte — no specular highlight
    );
    rock.material = mat;
  }
}

// ── Cacti ─────────────────────────────────────────────────────────────────────
// Each cactus is built from individual meshes (no createInstance) so that
// the material is applied directly and reliably without any instance
// material-inheritance ambiguity.

const CACTUS_COUNT = 70;

function makeCactusMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("cactusMat", scene);
  // Strong diffuse green.  The emissive component is large enough to stay
  // clearly green even when the warm desert sun tints the lit faces orange.
  m.diffuseColor  = new Color3(0.08, 0.52, 0.16);
  m.emissiveColor = new Color3(0.04, 0.18, 0.06);
  m.specularColor = new Color3(0.02, 0.04, 0.02);
  return m;
}

function cactCyl(
  scene: Scene,
  name: string,
  mat: StandardMaterial,
  dTop: number, dBot: number, h: number,
): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { diameterTop: dTop, diameterBottom: dBot, height: h, tessellation: 8 }, scene);
  m.material = mat;
  m.isPickable = false;
  return m;
}

export function placeCacti(scene: Scene): void {
  const rng = makeRng(77);
  const half = TERRAIN_SIZE / 2 - 8;
  const mat = makeCactusMat(scene);

  for (let i = 0; i < CACTUS_COUNT; i++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    if (Math.abs(x) < ROCK_EXCLUSION && Math.abs(z) < ROCK_EXCLUSION) {
      continue;
    }

    const groundY = terrainHeight(x, z);
    const stemH = 1.8 + rng() * 2.4;

    // Trunk
    const trunk = cactCyl(scene, `cactTrunk_${i}`, mat, 0.34, 0.44, stemH);
    trunk.position.set(x, groundY + stemH / 2, z);

    // Arms (1 or 2)
    const numArms = rng() > 0.4 ? 2 : 1;
    for (let a = 0; a < numArms; a++) {
      const side = a === 0 ? 1 : -1;
      const armH = 0.9 + rng() * 1.1;
      const armRise = 0.7 + rng() * 0.6;
      const armAttachY = groundY + stemH * (0.45 + rng() * 0.3);

      // Horizontal segment
      const hArm = cactCyl(scene, `cactHArm_${i}_${a}`, mat, 0.22, 0.28, armH);
      hArm.rotation.z = Math.PI / 2;
      hArm.position.set(x + side * armH * 0.5, armAttachY, z);

      // Vertical tip
      const vArm = cactCyl(scene, `cactVArm_${i}_${a}`, mat, 0.18, 0.26, armRise);
      vArm.position.set(x + side * armH, armAttachY + armRise / 2, z);
    }
  }
}

// ── Mesas ─────────────────────────────────────────────────────────────────────
// All mesas are at distance ≥ 165 from the centre — well beyond the 110-unit
// terrain-mesh edge — so they read as horizon scenery, never as in-field
// obstacles.  The far-ground backing plane ensures they appear grounded.
// Each mesa has four layers: a wide ground skirt, a tapered body with a
// visible strata band, a narrow cap, and a flat pale top disc.

interface MesaDef {
  angle: number;     // radians from north
  distance: number;  // from world centre (always ≥ 165)
  skirtR: number;    // outer radius of ground-skirt layer
  bodyR: number;     // base radius of main body
  capR: number;      // radius of cap / plateau
  skirtH: number;    // height of skirt
  bodyH: number;     // height of main body
  capH: number;      // height of cap
  colorShift: number;
}

const MESA_DEFS: MesaDef[] = [
  // North — large imposing butte
  { angle: 0.15, distance: 355, skirtR: 80, bodyR: 58, capR: 40, skirtH: 7,  bodyH: 38, capH: 13, colorShift:  0.00 },
  // NNE — mid-distance spire
  { angle: 0.50, distance: 290, skirtR: 46, bodyR: 30, capR: 18, skirtH: 4,  bodyH: 36, capH:  9, colorShift:  0.04 },
  // NE — tall narrow spire
  { angle: 0.85, distance: 335, skirtR: 58, bodyR: 40, capR: 24, skirtH: 6,  bodyH: 46, capH: 11, colorShift:  0.05 },
  // East — wide low mesa
  { angle: 1.65, distance: 370, skirtR: 98, bodyR: 70, capR: 50, skirtH: 6,  bodyH: 24, capH: 15, colorShift: -0.03 },
  // ESE — medium butte
  { angle: 2.10, distance: 305, skirtR: 64, bodyR: 44, capR: 28, skirtH: 5,  bodyH: 32, capH: 10, colorShift: -0.01 },
  // SE — tall narrow spire
  { angle: 2.55, distance: 340, skirtR: 50, bodyR: 32, capR: 18, skirtH: 5,  bodyH: 52, capH: 10, colorShift:  0.02 },
  // South — broad distant butte
  { angle: 3.30, distance: 385, skirtR: 88, bodyR: 64, capR: 44, skirtH: 7,  bodyH: 30, capH: 14, colorShift: -0.02 },
  // SSW — smaller formation
  { angle: 3.80, distance: 295, skirtR: 50, bodyR: 34, capR: 20, skirtH: 4,  bodyH: 30, capH:  9, colorShift:  0.01 },
  // SW
  { angle: 4.10, distance: 344, skirtR: 66, bodyR: 46, capR: 30, skirtH: 6,  bodyH: 42, capH: 12, colorShift:  0.04 },
  // West — giant landmark
  { angle: 4.90, distance: 376, skirtR: 105, bodyR: 76, capR: 54, skirtH: 8, bodyH: 34, capH: 16, colorShift:  0.00 },
  // NW
  { angle: 5.65, distance: 330, skirtR: 62, bodyR: 42, capR: 26, skirtH: 5,  bodyH: 40, capH: 11, colorShift:  0.03 },
  // NNW — low wide plateau
  { angle: 6.00, distance: 285, skirtR: 74, bodyR: 52, capR: 36, skirtH: 5,  bodyH: 20, capH: 12, colorShift: -0.02 },
];

export function placeMesas(scene: Scene): void {
  for (let i = 0; i < MESA_DEFS.length; i++) {
    const def = MESA_DEFS[i]!;
    const mx = Math.sin(def.angle) * def.distance;
    const mz = Math.cos(def.angle) * def.distance;
    // Anchor to the far-ground plane level so mesas always look grounded.
    const groundY = DESERT_FLOOR - 0.02;

    // ── Skirt — wide shallow cone that merges with the desert floor
    const skirt = MeshBuilder.CreateCylinder(
      `mesaSkirt_${i}`,
      {
        diameterTop:    def.bodyR  * 2 * 1.02,
        diameterBottom: def.skirtR * 2,
        height:         def.skirtH,
        tessellation:   32,
      },
      scene,
    );
    skirt.position.set(mx, groundY + def.skirtH / 2, mz);
    skirt.isPickable = false;
    const sc = 0.50 + def.colorShift;
    skirt.material = makeMat(
      scene, `mesaSkirtMat_${i}`,
      new Color3(sc * 1.10, sc * 0.74, sc * 0.54), 0.03,
    );

    // ── Body — main cliff face, strongly tapered
    const bodyBase = groundY + def.skirtH;
    const body = MeshBuilder.CreateCylinder(
      `mesaBody_${i}`,
      {
        diameterTop:    def.capR  * 2 * 1.04,
        diameterBottom: def.bodyR * 2,
        height:         def.bodyH,
        tessellation:   32,
      },
      scene,
    );
    body.position.set(mx, bodyBase + def.bodyH / 2, mz);
    body.isPickable = false;
    const bc = 0.56 + def.colorShift;
    body.material = makeMat(
      scene, `mesaBodyMat_${i}`,
      new Color3(bc * 1.06, bc * 0.70, bc * 0.50), 0.04,
    );

    // ── Strata band — dark ring of geological layering at mid-cliff
    const strataFrac = 0.42;
    const strataTopD  = def.capR  * 2 * 1.04 + (def.bodyR - def.capR)  * 2 * (1 - strataFrac) * 1.04;
    const strataBotD  = strataTopD * 1.08;
    const strata = MeshBuilder.CreateCylinder(
      `mesaStrata_${i}`,
      {
        diameterTop:    strataTopD,
        diameterBottom: strataBotD,
        height:         def.bodyH * 0.13,
        tessellation:   32,
      },
      scene,
    );
    strata.position.set(mx, bodyBase + def.bodyH * strataFrac, mz);
    strata.isPickable = false;
    const stc = 0.36 + def.colorShift;
    strata.material = makeMat(
      scene, `mesaStrataMat_${i}`,
      new Color3(stc * 1.04, stc * 0.72, stc * 0.54), 0.03,
    );

    // ── Cap — flat-topped summit layer
    const capBase = bodyBase + def.bodyH;
    const cap = MeshBuilder.CreateCylinder(
      `mesaCap_${i}`,
      {
        diameterTop:    def.capR * 2 * 0.96,
        diameterBottom: def.capR * 2,
        height:         def.capH,
        tessellation:   32,
      },
      scene,
    );
    cap.position.set(mx, capBase + def.capH / 2, mz);
    cap.isPickable = false;
    const cc = 0.46 + def.colorShift;
    cap.material = makeMat(
      scene, `mesaCapMat_${i}`,
      new Color3(cc * 1.04, cc * 0.67, cc * 0.48), 0.03,
    );

    // ── Top disc — lighter sandy plateau surface
    const top = MeshBuilder.CreateDisc(
      `mesaTop_${i}`,
      { radius: def.capR * 0.96, tessellation: 32, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    top.rotation.x = Math.PI / 2;
    top.position.set(mx, capBase + def.capH + 0.05, mz);
    top.isPickable = false;
    const tc = 0.70 + def.colorShift;
    top.material = makeMat(
      scene, `mesaTopMat_${i}`,
      new Color3(tc * 1.0, tc * 0.84, tc * 0.66), 0.05,
    );
  }
}

// ── Challenge Hill markers ─────────────────────────────────────────────────────
// A flag pole + banner at the summit, and eight yellow warning posts around the
// base perimeter so the hill is unmistakeable from a distance.

export function placeHillMarkers(scene: Scene): void {
  const summitY = terrainHeight(CHALLENGE_HILL_X, CHALLENGE_HILL_Z);

  // ── Flag pole ────────────────────────────────────────────────────────────
  const poleMat = makeMat(scene, "hillPole", new Color3(0.80, 0.80, 0.82), 0.5);
  const pole = MeshBuilder.CreateCylinder("hillPole",
    { diameter: 0.36, height: 11, tessellation: 8 }, scene);
  pole.position.set(CHALLENGE_HILL_X, summitY + 5.5, CHALLENGE_HILL_Z);
  pole.isPickable = false;
  pole.material = poleMat;

  // ── Banner ───────────────────────────────────────────────────────────────
  // Alternating green / white stripes to match the crawler's olive colour.
  for (let s = 0; s < 2; s++) {
    const stripeMat = makeMat(
      scene,
      `hillStripe${s}`,
      s === 0 ? new Color3(0.08, 0.60, 0.18) : new Color3(0.95, 0.95, 0.95),
      0.1,
    );
    const stripe = MeshBuilder.CreateBox(`hillStripe${s}`,
      { width: 2.80, height: 0.65, depth: 0.07 }, scene);
    stripe.position.set(
      CHALLENGE_HILL_X + 1.40,
      summitY + 10.5 - s * 0.65,
      CHALLENGE_HILL_Z,
    );
    stripe.isPickable = false;
    stripe.material = stripeMat;
  }

  // ── Base warning posts ────────────────────────────────────────────────────
  // 8 posts evenly spaced around the hill circumference, in green/yellow.
  const postMat = makeMat(scene, "hillPost", new Color3(0.95, 0.82, 0.08), 0.3);
  const capMat  = makeMat(scene, "hillCap",  new Color3(0.10, 0.62, 0.20), 0.1);
  const POST_COUNT = 8;
  for (let i = 0; i < POST_COUNT; i++) {
    const angle = (i / POST_COUNT) * Math.PI * 2;
    const px = CHALLENGE_HILL_X + Math.sin(angle) * (CHALLENGE_HILL_RADIUS + 2);
    const pz = CHALLENGE_HILL_Z + Math.cos(angle) * (CHALLENGE_HILL_RADIUS + 2);
    const py = terrainHeight(px, pz);

    const postH = 2.6;
    const post = MeshBuilder.CreateCylinder(`hillPost${i}`,
      { diameter: 0.28, height: postH, tessellation: 6 }, scene);
    post.position.set(px, py + postH / 2, pz);
    post.isPickable = false;
    post.material = postMat;

    // Small green cap on top
    const cap = MeshBuilder.CreateCylinder(`hillCap${i}`,
      { diameter: 0.44, height: 0.30, tessellation: 6 }, scene);
    cap.position.set(px, py + postH + 0.15, pz);
    cap.isPickable = false;
    cap.material = capMat;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function populateWorld(scene: Scene): void {
  createFarGround(scene);
  placeMesas(scene);
  placeCacti(scene);
  placeHillMarkers(scene);
}
