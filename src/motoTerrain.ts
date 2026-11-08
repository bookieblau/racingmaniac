import { Vector3 } from "@babylonjs/core";

/** Overall scale for the motocross play space (terrain footprint + circuit). */
export const MOTO_MAP_SCALE = 1.55;

export const TERRAIN_SIZE = Math.round(440 * MOTO_MAP_SCALE);
export const TERRAIN_SUBDIVISIONS = Math.round(220 * MOTO_MAP_SCALE);

const S = MOTO_MAP_SCALE;

export const MOTO_SPAWN = { x: 0, z: -145 * S, heading: Math.PI / 2 };

// ── Track loop ───────────────────────────────────────────────────────────────
// Wraps a hillside: valley start/finish, climbs the east face, crests up top,
// flows down the west side back to the bottom.

interface Point {
  x: number;
  z: number;
}

/** Outdoor MX loop — long straights for whoops/jumps, bermed corners, modest elevation. */
const LOOP_BASE: Point[] = [
  { x: 0,     z: -145 }, // 0 — start / finish
  { x: 118,   z: -145 }, // 1 — launch straight
  { x: 148,   z: -86  }, // 2 — turn 1
  { x: 148,   z: 38   }, // 3 — uphill leg
  { x: 98,    z: 112  }, // 4 — tabletop berm
  { x: -18,   z: 128  }, // 5 — ridge
  { x: -128,  z: 96   }, // 6 — downhill
  { x: -150,  z: 8    }, // 7 — outside sweeper
  { x: -108,  z: -98  }, // 8 — rhythm alley
  { x: -38,   z: -140 }, // 9 — onto start straight
];

const LOOP: Point[] = LOOP_BASE.map((p) => ({ x: p.x * S, z: p.z * S }));

const TRACK_RADIUS = 22 * S;

export interface Checkpoint {
  x: number;
  z: number;
  radius: number;
  label: string;
}

export const MOTO_CHECKPOINTS: Checkpoint[] = [
  { x: 62 * S,   z: -145 * S, radius: 16 * S, label: "Holeshot" },
  { x: 148 * S,  z: -22 * S,  radius: 16 * S, label: "Turn 1" },
  { x: 108 * S,  z: 92 * S,   radius: 16 * S, label: "Tabletop" },
  { x: -132 * S, z: 52 * S,   radius: 16 * S, label: "Downhill" },
  { x: 0,        z: -145 * S, radius: 18 * S, label: "Finish" },
];

/** Rolling outdoor MX elevation — no mega hillside terraces. */
const LOOP_ELEV = [0, 0, 1.5, 4, 7, 8, 6, 3, 1.2, 0].map((e) => e * S);

// ── Jump ramps ───────────────────────────────────────────────────────────────
// Same crest-shape formula as the Drift Arena's ramps, just laid along this
// track's straights instead of scattered in an open lot. Headings are derived
// from the loop geometry itself, not hand-typed, so they always line up.

export type JumpKind = "single" | "tabletop" | "stepup" | "double" | "gap";

export interface JumpRamp {
  cx: number;
  cz: number;
  heading: number;
  width: number;
  approach: number;
  lip: number;
  landing: number;
  height: number;
  kind: JumpKind;
  /** Flat deck length after the first lip (tabletops). */
  tableLength?: number;
  /** Raised landing plateau for step-up jumps. */
  stepRise?: number;
  /** Center-to-center spacing between lips on a double. */
  doubleGap?: number;
  /** Open dirt gap between takeoff lip and landing (gap + step-up jumps). */
  gapLength?: number;
}

/** Heading for ramp local +lx (up the jump). Travel along the segment is (sin(h+π/2), cos(h+π/2)). */
function segmentHeading(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.atan2(-dz, dx);
}

function pointAlong(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

type JumpPlan = {
  t: number;
  width: number;
  approach: number;
  lip: number;
  landing: number;
  height: number;
  kind: JumpKind;
  tableLength?: number;
  stepRise?: number;
  doubleGap?: number;
  gapLength?: number;
};

/** Lips tuned for ~35–40 km/h dirt-bike clears — horizontal features scale with map. */
const JUMP_VERT_SCALE = 0.88;

function scaleJump(j: JumpPlan): JumpPlan {
  return {
    ...j,
    width: j.width * S,
    approach: j.approach * S,
    lip: j.lip * S,
    landing: j.landing * S,
    height: j.height * JUMP_VERT_SCALE,
    tableLength: j.tableLength !== undefined ? j.tableLength * S : undefined,
    stepRise: j.stepRise !== undefined ? j.stepRise * S : undefined,
    doubleGap: j.doubleGap !== undefined ? j.doubleGap * S : undefined,
    gapLength: j.gapLength !== undefined ? j.gapLength * S : undefined,
  };
}

// Classic MX mix — tabletops, doubles, one step-up on the uphill, finish-line gap.
function buildRamps(): JumpRamp[] {
  const plan: [segIdx: number, jumps: JumpPlan[]][] = [
    [0, [
      scaleJump({
        t: 0.62, kind: "tabletop", tableLength: 11, width: 26, approach: 16, lip: 3.2,
        landing: 22, height: 2.75,
      }),
    ]],
    [1, [
      scaleJump({
        t: 0.45, kind: "double", doubleGap: 10.5, width: 22, approach: 14, lip: 3,
        landing: 20, height: 2.55,
      }),
    ]],
    [3, [
      scaleJump({
        t: 0.38, kind: "stepup", gapLength: 13, stepRise: 2.0, width: 22, approach: 14, lip: 3,
        landing: 20, height: 2.85,
      }),
      scaleJump({
        t: 0.74, kind: "single", width: 20, approach: 12, lip: 2.8, landing: 16, height: 2.35,
      }),
    ]],
    [4, [
      scaleJump({
        t: 0.48, kind: "tabletop", tableLength: 13, width: 24, approach: 15, lip: 3.2,
        landing: 21, height: 2.95,
      }),
    ]],
    [6, [
      scaleJump({
        t: 0.52, kind: "double", doubleGap: 11, width: 22, approach: 14, lip: 3,
        landing: 19, height: 2.65,
      }),
    ]],
    [8, [
      scaleJump({
        t: 0.55, kind: "gap", gapLength: 11, width: 20, approach: 13, lip: 3,
        landing: 18, height: 2.45,
      }),
    ]],
  ];

  const ramps: JumpRamp[] = [];
  for (const [segIdx, jumps] of plan) {
    const a = LOOP[segIdx]!;
    const b = LOOP[(segIdx + 1) % LOOP.length]!;
    const heading = segmentHeading(a, b);
    for (const jump of jumps) {
      const p = pointAlong(a, b, jump.t);
      ramps.push({
        cx: p.x,
        cz: p.z,
        heading,
        width: jump.width,
        approach: jump.approach,
        lip: jump.lip,
        landing: jump.landing,
        height: jump.height,
        kind: jump.kind,
        tableLength: jump.tableLength,
        stepRise: jump.stepRise,
        doubleGap: jump.doubleGap,
        gapLength: jump.gapLength,
      });
    }
  }
  return ramps;
}

export const MOTO_RAMPS: JumpRamp[] = buildRamps();

// ── Whoops (rhythm rollers) ───────────────────────────────────────────────────

export interface WhoopRow {
  cx: number;
  cz: number;
  heading: number;
  width: number;
  length: number;
  count: number;
  amplitude: number;
}

function buildWhoops(): WhoopRow[] {
  const rows: WhoopRow[] = [];
  const specs: [segIdx: number, t: number, length: number, count: number, amp: number][] = [
    [0, 0.18, 24, 10, 0.34],
    [1, 0.78, 14, 7, 0.28],
    [8, 0.28, 20, 9, 0.32],
    [9, 0.55, 12, 5, 0.24],
  ];
  for (const [segIdx, t, length, count, amp] of specs) {
    const a = LOOP[segIdx]!;
    const b = LOOP[(segIdx + 1) % LOOP.length]!;
    const p = pointAlong(a, b, t);
    rows.push({
      cx: p.x,
      cz: p.z,
      heading: segmentHeading(a, b),
      width: 20 * S,
      length: length * S,
      count,
      amplitude: amp * S,
    });
  }
  return rows;
}

export const MOTO_WHOOPS: WhoopRow[] = buildWhoops();

function whoopHeight(x: number, z: number, row: WhoopRow): number {
  const sin = Math.sin(row.heading);
  const cos = Math.cos(row.heading);
  const lx = (x - row.cx) * cos - (z - row.cz) * sin;
  const ly = (x - row.cx) * sin + (z - row.cz) * cos;
  if (Math.abs(ly) > row.width / 2) return 0;
  if (lx < 0 || lx > row.length) return 0;

  const bump = Math.sin((lx / row.length) * row.count * Math.PI * 2) * 0.5 + 0.5;
  const endFade = Math.min(lx / (row.length * 0.12), (row.length - lx) / (row.length * 0.12), 1);
  const sideFade = 1 - smoothstep(Math.abs(ly) / (row.width * 0.5));
  return row.amplitude * bump * smoothstep(endFade) * sideFade;
}

const CORNER_SEGMENTS = new Set([1, 2, 4, 5, 6, 7, 9]);

function nearestSegmentIndex(x: number, z: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i]!;
    const b = LOOP[(i + 1) % LOOP.length]!;
    const d = distToSegment(x, z, a, b);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function jumpCrest(
  lx: number,
  lipX: number,
  climb: number,
  descent: number,
  height: number,
): number {
  const d = lx - lipX;
  if (d < -climb || d > descent) return 0;
  if (d < 0) {
    const t = (d + climb) / climb;
    const eased = smoothstep(t);
    const kick = t > 0.85 ? ((t - 0.85) / 0.15) * 0.05 : 0;
    return Math.min(height * 1.02, (eased + kick) * height);
  }
  return rampLandingHeight(d, descent, height);
}

function rampApproachHeight(lx: number, start: number, height: number): number {
  const t = (lx - start) / (-start);
  const eased = smoothstep(t);
  const kick = t > 0.85 ? ((t - 0.85) / 0.15) * 0.05 : 0;
  return Math.min(height * 1.02, (eased + kick) * height);
}

function rampLandingHeight(lx: number, landingLen: number, height: number): number {
  const t = lx / landingLen;
  return height * (1 - smoothstep(t));
}

function rampEndLocal(ramp: JumpRamp): number {
  const air = ramp.gapLength ?? 0;
  switch (ramp.kind) {
    case "tabletop":
      return (ramp.tableLength ?? 10) + ramp.landing;
    case "stepup":
      return air + ramp.landing;
    case "gap":
      return air + ramp.landing;
    case "double":
      return (ramp.doubleGap ?? 9) + ramp.landing;
    default:
      return ramp.landing;
  }
}

function rampProfile(lx: number, ramp: JumpRamp): number {
  const start = -ramp.approach;
  if (lx < start) return 0;

  if (lx < 0) {
    return rampApproachHeight(lx, start, ramp.height);
  }

  switch (ramp.kind) {
    case "tabletop": {
      const deck = ramp.tableLength ?? 10;
      if (lx <= deck) return ramp.height;
      return rampLandingHeight(lx - deck, ramp.landing, ramp.height);
    }
    case "stepup": {
      const rise = ramp.stepRise ?? 1.2;
      const air = ramp.gapLength ?? 0;
      if (air > 0 && lx > 0 && lx < air) return 0;
      const landLx = lx - air;
      if (landLx <= 0) return 0;
      const climb = ramp.landing * 0.3;
      const terrace = ramp.landing * 0.42;
      const top = ramp.height + rise;
      if (landLx <= climb) {
        const t = landLx / Math.max(0.01, climb);
        return lerp(0, top, smoothstep(t));
      }
      if (landLx <= climb + terrace) return top;
      const t = (landLx - climb - terrace) / Math.max(0.01, ramp.landing - climb - terrace);
      return top * (1 - smoothstep(Math.max(0, Math.min(1, t))));
    }
    case "gap": {
      const air = ramp.gapLength ?? 18;
      if (lx > 0 && lx < air) return 0;
      const landLx = lx - air;
      if (landLx <= 0) return 0;
      return rampLandingHeight(landLx, ramp.landing, ramp.height);
    }
    case "double": {
      const gap = ramp.doubleGap ?? 9;
      return Math.max(
        jumpCrest(lx, 0, ramp.approach * 0.55, gap * 0.38, ramp.height),
        jumpCrest(lx, gap, gap * 0.32, ramp.landing * 0.7, ramp.height * 0.9),
      );
    }
    default:
      return rampLandingHeight(lx, ramp.landing, ramp.height);
  }
}

function rampHeight(x: number, z: number, ramp: JumpRamp): number {
  const sin = Math.sin(ramp.heading);
  const cos = Math.cos(ramp.heading);
  const lx = (x - ramp.cx) * cos - (z - ramp.cz) * sin;
  const ly = (x - ramp.cx) * sin + (z - ramp.cz) * cos;

  if (Math.abs(ly) > ramp.width / 2) return 0;

  const start = -ramp.approach;
  const end = rampEndLocal(ramp);
  if (lx < start || lx > end) return 0;

  return rampProfile(lx, ramp);
}

// ── Height field ─────────────────────────────────────────────────────────────

function closestOnLoop(x: number, z: number): { seg: number; t: number; dist: number } {
  let best = { seg: 0, t: 0, dist: Infinity };
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i]!;
    const b = LOOP[(i + 1) % LOOP.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    if (len2 < 0.001) continue;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (d < best.dist) best = { seg: i, t, dist: d };
  }
  return best;
}

/** Flat MX venue pad — groomed track in a low grass bowl, not desert hills. */
function venuePad(x: number, z: number): number {
  const d = distToTrack(x, z);
  const edge = smoothstep((d - TRACK_RADIUS * 0.5) / (TRACK_RADIUS * 2.8));
  const bowl = edge * edge * 2.8 * S;
  const micro = (fbm(x * 0.028, z * 0.026) - 0.5) * (d > TRACK_RADIUS + 10 ? 0.9 * S : 0.18 * S);
  return bowl + micro;
}

/** Terraced climb locked to the race line along the loop. */
function trackClimbBed(x: number, z: number): number {
  const { seg, t, dist } = closestOnLoop(x, z);
  const e0 = LOOP_ELEV[seg] ?? 0;
  const e1 = LOOP_ELEV[(seg + 1) % LOOP.length] ?? e0;
  const along = lerp(e0, e1, t);
  const blend = 1 - smoothstep(dist / (TRACK_RADIUS * 1.4));
  return along * blend;
}

function baseHeight(x: number, z: number): number {
  return venuePad(x, z) + trackClimbBed(x, z);
}

// Dirt berms bank both edges of the whole loop — low and flat down the
// racing line, rising to a rounded wall right at the track edge, then
// dropping back to the surrounding desert just past it. Gives the circuit a
// real motocross "dug channel" look and lets you lean the bike into it.
const BERM_HEIGHT = 2.65 * S;
const BERM_CREST = TRACK_RADIUS * 0.86;
const BERM_OUTER = TRACK_RADIUS + 5;

function bermHeight(x: number, z: number): number {
  const d = distToTrack(x, z);
  if (d >= BERM_OUTER) return 0;
  let h: number;
  if (d <= BERM_CREST) {
    h = smoothstep(d / BERM_CREST) * BERM_HEIGHT;
  } else {
    const t = (d - BERM_CREST) / (BERM_OUTER - BERM_CREST);
    h = BERM_HEIGHT * (1 - smoothstep(t));
  }
  if (d < TRACK_RADIUS * 1.05 && CORNER_SEGMENTS.has(nearestSegmentIndex(x, z))) {
    h *= 1.28;
  }
  return h;
}

function rutCut(x: number, z: number): number {
  const d = distToTrack(x, z);
  if (d > TRACK_RADIUS * 0.42) return 0;
  const groove = 1 - smoothstep(d / (TRACK_RADIUS * 0.42));
  return groove * groove * 0.38 * S;
}

export function terrainHeight(x: number, z: number): number {
  let feature = 0;
  for (const ramp of MOTO_RAMPS) {
    feature = Math.max(feature, rampHeight(x, z, ramp));
  }
  for (const row of MOTO_WHOOPS) {
    feature = Math.max(feature, whoopHeight(x, z, row));
  }
  const d = distToTrack(x, z);
  const rough = (fbm(x * 0.05, z * 0.05) - 0.5) * (d > TRACK_RADIUS + 6 ? 1.8 * S : 0.35 * S);
  return baseHeight(x, z) + rough + bermHeight(x, z) + feature - rutCut(x, z);
}

const NORMAL_SAMPLE = 0.9;

export function terrainNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const heightLeft = terrainHeight(x - NORMAL_SAMPLE, z);
  const heightRight = terrainHeight(x + NORMAL_SAMPLE, z);
  const heightBack = terrainHeight(x, z - NORMAL_SAMPLE);
  const heightFront = terrainHeight(x, z + NORMAL_SAMPLE);

  out.set(heightLeft - heightRight, NORMAL_SAMPLE * 2, heightBack - heightFront);
  out.normalize();
  return out;
}

// ── Track-corridor test (decoration placement only — no gameplay penalty) ────

function distToSegment(px: number, pz: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 0.001) return Math.hypot(px - a.x, pz - a.z);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
  return Math.hypot(px - a.x - t * dx, pz - a.z - t * dz);
}

export function distToTrack(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < LOOP.length; i++) {
    const a = LOOP[i]!;
    const b = LOOP[(i + 1) % LOOP.length]!;
    best = Math.min(best, distToSegment(x, z, a, b));
  }
  return best;
}

export function isOnTrack(x: number, z: number, extraRadius = 0): boolean {
  return distToTrack(x, z) <= TRACK_RADIUS + extraRadius;
}

export const MOTO_LOOP: readonly Point[] = LOOP;
export const MOTO_TRACK_RADIUS = TRACK_RADIUS;

// ── Noise helpers ────────────────────────────────────────────────────────────

function fbm(x: number, z: number): number {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.1, z * 2.1) * 0.25 +
    valueNoise(x * 4.3, z * 4.3) * 0.12 +
    valueNoise(x * 8.6, z * 8.6) * 0.08
  );
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const sx = smoothstep(x - x0);
  const sz = smoothstep(z - z0);

  const n00 = hash(x0, z0);
  const n10 = hash(x1, z0);
  const n01 = hash(x0, z1);
  const n11 = hash(x1, z1);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sz);
}

function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
