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

import { InputManager } from "./input";
import { TERRAIN_SIZE, terrainHeight, terrainNormal } from "./terrain";

const HALF_EXTENT = TERRAIN_SIZE / 2 - 4;

export const MAX_SPEED = 34;

const GRAVITY = 22;
const ACCELERATION = 28;
const BRAKE = 40;
const STEER_SPEED = 2.8;
const MIN_STEER_FACTOR = 0.45;
const GROUND_EPSILON = 0.05;
const MAX_VERTICAL_VELOCITY = 14;

// Liftoff: terrain must drop at this rate (m/s) AND car speed must exceed minimum
const LIFTOFF_THRESHOLD  = 15;  // m/s of ground-fall rate
const LIFTOFF_MIN_SPEED  = 7;   // m/s car speed required for liftoff

const TILT_BLEND = 8;
const AIR_TILT_DECAY = 6;
const MAX_PITCH = 0.28;
const MAX_ROLL = 0.28;

// Car geometry constants (root Y = wheel bottom contact point)
const WHEEL_RADIUS = 0.52;
const WHEEL_THICKNESS = 0.30;
const AXLE_Y = WHEEL_RADIUS;           // local: axle centre above root
const FRONT_AXLE_Z = 1.32;
const REAR_AXLE_Z = -1.28;
const AXLE_X = 1.12;                   // half-width to axle centre

// Root sits at wheel-bottom height (near ground)
const CAR_BOTTOM_OFFSET = 0.04;

// Ground sampling uses wheel corner positions in forward/right space
const WHEEL_SAMPLE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [FRONT_AXLE_Z, 0],
  [REAR_AXLE_Z, 0],
  [FRONT_AXLE_Z,  AXLE_X],
  [FRONT_AXLE_Z, -AXLE_X],
  [REAR_AXLE_Z,   AXLE_X],
  [REAR_AXLE_Z,  -AXLE_X],
];

export class Car {
  readonly root: TransformNode;

  private speed = 0;
  private heading = 0;
  private altitude = 0;
  private verticalVelocity = 0;
  private previousGroundY = 0;
  private pitch = 0;
  private roll = 0;
  private airborne = false;
  private wheelRotation = 0;
  private readonly wheels: TransformNode[] = [];
  private readonly position = new Vector3(0, 0, 0);
  private readonly scratchNormal = new Vector3();

  constructor(scene: Scene) {
    this.root = new TransformNode("carRoot", scene);
    this.buildVisuals(scene);

    this.previousGroundY = sampleGroundUnderCar(0, 0, this.heading);
    this.altitude = this.previousGroundY + CAR_BOTTOM_OFFSET;
    this.syncTransform();
  }

  update(deltaSeconds: number, input: InputManager): void {
    // ── Throttle / brake ────────────────────────────────────────────────────
    if (input.isActive("forward")) {
      this.speed = Math.min(this.speed + ACCELERATION * deltaSeconds, MAX_SPEED);
    } else if (input.isActive("backward")) {
      this.speed = Math.max(this.speed - BRAKE * deltaSeconds, -MAX_SPEED * 0.45);
    } else {
      const drag = this.speed > 0 ? -14 : 14;
      const next = this.speed + drag * deltaSeconds;
      this.speed =
        Math.sign(this.speed) !== Math.sign(next) || Math.abs(next) < 0.2 ? 0 : next;
    }

    // ── Steering ────────────────────────────────────────────────────────────
    const steerDir = input.isActive("left") ? -1 : input.isActive("right") ? 1 : 0;
    if (steerDir !== 0) {
      const speedFactor = Math.max(MIN_STEER_FACTOR, Math.abs(this.speed) / MAX_SPEED);
      this.heading += steerDir * STEER_SPEED * speedFactor * deltaSeconds;
    }

    // ── Move ────────────────────────────────────────────────────────────────
    this.position.x += Math.sin(this.heading) * this.speed * deltaSeconds;
    this.position.z += Math.cos(this.heading) * this.speed * deltaSeconds;
    this.position.x = clamp(this.position.x, -HALF_EXTENT, HALF_EXTENT);
    this.position.z = clamp(this.position.z, -HALF_EXTENT, HALF_EXTENT);

    // ── Vertical (jump / gravity) ────────────────────────────────────────────
    const groundY = sampleGroundUnderCar(this.position.x, this.position.z, this.heading);
    const tiltLift =
      Math.abs(Math.sin(this.pitch)) * 1.1 + Math.abs(Math.sin(this.roll)) * 0.75;
    const groundContact = groundY + CAR_BOTTOM_OFFSET + tiltLift;

    // Rate at which the terrain is dropping under the car (m/s, negative = falling away)
    const groundFallRate = (groundY - this.previousGroundY) / deltaSeconds;

    if (!this.airborne) {
      // Liftoff: terrain falls away faster than the car can naturally follow at crests.
      if (this.speed >= LIFTOFF_MIN_SPEED && groundFallRate < -LIFTOFF_THRESHOLD) {
        this.airborne = true;
        this.verticalVelocity = 0;
      } else {
        // Stay firmly on ground — snap altitude to terrain contact point.
        this.altitude = groundContact;
        this.verticalVelocity = 0;
        this.airborne = false;
      }
    } else {
      this.verticalVelocity = Math.max(
        this.verticalVelocity - GRAVITY * deltaSeconds,
        -MAX_VERTICAL_VELOCITY,
      );
      this.altitude += this.verticalVelocity * deltaSeconds;

      if (this.altitude <= groundContact) {
        this.altitude = groundContact;
        this.verticalVelocity = 0;
        this.airborne = false;
      } else {
        this.airborne = this.altitude > groundContact + GROUND_EPSILON * 2;
      }
    }

    // ── Wheel spin ──────────────────────────────────────────────────────────
    this.wheelRotation += (this.speed / WHEEL_RADIUS) * deltaSeconds;
    const spinQ = Quaternion.FromEulerAngles(this.wheelRotation, 0, 0);
    for (const hub of this.wheels) {
      hub.rotationQuaternion = spinQ;
    }

    this.updateTilt(deltaSeconds);
    this.previousGroundY = groundY;
    this.syncTransform();
  }

  getWorldPosition(): Vector3 {
    return this.root.position.clone();
  }

  getHeading(): number {
    return this.heading;
  }

  getSpeed(): number {
    return this.speed;
  }

  getMaxSpeed(): number {
    return MAX_SPEED;
  }

  isAirborne(): boolean {
    return this.airborne;
  }

  /**
   * World-space positions of all four wheel hubs in order:
   * [0] right-front, [1] left-front, [2] right-rear, [3] left-rear.
   * Y is approximate (altitude + axle height) — good enough for dust/tracks.
   */
  getWheelWorldPositions(): Vector3[] {
    const px = this.root.position.x;
    const py = this.root.position.y;
    const pz = this.root.position.z;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);

    // local axle offsets: [right(+X), up(+Y), forward(+Z)]
    const axles: [number, number, number][] = [
      [ AXLE_X,  AXLE_Y, FRONT_AXLE_Z],
      [-AXLE_X,  AXLE_Y, FRONT_AXLE_Z],
      [ AXLE_X,  AXLE_Y, REAR_AXLE_Z],
      [-AXLE_X,  AXLE_Y, REAR_AXLE_Z],
    ];

    return axles.map(([lx, ly, lz]) =>
      new Vector3(
        px + lx * cosH + lz * sinH,
        py + ly,
        pz - lx * sinH + lz * cosH,
      ),
    );
  }

  // ── Build visuals ──────────────────────────────────────────────────────────

  private buildVisuals(scene: Scene): void {
    const bodyMat  = mat(scene, "body",  new Color3(0.78, 0.16, 0.12));
    const hoodMat  = mat(scene, "hood",  new Color3(0.60, 0.12, 0.09));
    const glassMat = mat(scene, "glass", new Color3(0.35, 0.60, 0.88), 0.05);
    const tireMat  = mat(scene, "tire",  new Color3(0.15, 0.14, 0.13));
    const rimMat   = mat(scene, "rim",   new Color3(0.78, 0.78, 0.78), 0.55);
    const lightMat = mat(scene, "light", new Color3(1.0,  0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));
    const brakeMat = mat(scene, "brake", new Color3(0.85, 0.18, 0.12), 0.0, new Color3(0.6, 0.05, 0.05));
    const bumperMat= mat(scene, "bumper",new Color3(0.22, 0.22, 0.22), 0.3);
    const rollMat  = mat(scene, "roll",  new Color3(0.30, 0.30, 0.28), 0.35);

    const BODY_Y   = AXLE_Y + 0.28;   // centre of main body slab
    const CABIN_Y  = BODY_Y + 0.28 + 0.38;  // centre of cabin

    // ── Chassis / body slab ─────────────────────────────────────────────────
    const body = box(scene, "body", 2.05, 0.56, 3.22);
    body.position.set(0, BODY_Y, 0);
    body.material = bodyMat;
    body.parent = this.root;

    // ── Hood (raised engine bay cover) ──────────────────────────────────────
    const hood = box(scene, "hood", 1.72, 0.16, 1.1);
    hood.position.set(0, BODY_Y + 0.28 + 0.08, 0.88);
    hood.material = hoodMat;
    hood.parent = this.root;

    // ── Cabin ───────────────────────────────────────────────────────────────
    const cabin = box(scene, "cabin", 1.62, 0.76, 1.68);
    cabin.position.set(0, CABIN_Y, -0.18);
    cabin.material = bodyMat;
    cabin.parent = this.root;

    // ── Windshield ───────────────────────────────────────────────────────────
    const ws = box(scene, "ws", 1.38, 0.58, 0.07);
    ws.position.set(0, CABIN_Y + 0.02, 0.68);
    ws.rotation.x = -0.22;
    ws.material = glassMat;
    ws.parent = this.root;

    // ── Rear window ─────────────────────────────────────────────────────────
    const rw = box(scene, "rw", 1.32, 0.50, 0.07);
    rw.position.set(0, CABIN_Y + 0.02, -1.02);
    rw.rotation.x = 0.22;
    rw.material = glassMat;
    rw.parent = this.root;

    // ── Side windows ────────────────────────────────────────────────────────
    for (const side of [-1, 1] as const) {
      const sw = box(scene, `sw${side}`, 0.07, 0.44, 1.2);
      sw.position.set(side * 0.815, CABIN_Y + 0.05, -0.18);
      sw.material = glassMat;
      sw.parent = this.root;
    }

    // ── Front bumper ─────────────────────────────────────────────────────────
    const fbump = box(scene, "fbump", 2.14, 0.30, 0.22);
    fbump.position.set(0, AXLE_Y + 0.12, FRONT_AXLE_Z + 0.24);
    fbump.material = bumperMat;
    fbump.parent = this.root;

    // ── Rear bumper ──────────────────────────────────────────────────────────
    const rbump = box(scene, "rbump", 2.10, 0.26, 0.20);
    rbump.position.set(0, AXLE_Y + 0.12, REAR_AXLE_Z - 0.22);
    rbump.material = bumperMat;
    rbump.parent = this.root;

    // ── Headlights ───────────────────────────────────────────────────────────
    for (const side of [-1, 1] as const) {
      const hl = box(scene, `hl${side}`, 0.26, 0.18, 0.07);
      hl.position.set(side * 0.72, BODY_Y + 0.10, FRONT_AXLE_Z + 0.14);
      hl.material = lightMat;
      hl.parent = this.root;
    }

    // ── Tail lights ───────────────────────────────────────────────────────────
    for (const side of [-1, 1] as const) {
      const tl = box(scene, `tl${side}`, 0.24, 0.16, 0.07);
      tl.position.set(side * 0.72, BODY_Y + 0.10, REAR_AXLE_Z - 0.12);
      tl.material = brakeMat;
      tl.parent = this.root;
    }

    // ── Roll cage bars ────────────────────────────────────────────────────────
    // Horizontal bar across top
    const rbar = box(scene, "rbar", 1.56, 0.09, 0.09);
    rbar.position.set(0, CABIN_Y + 0.38 + 0.045, -0.18);
    rbar.material = rollMat;
    rbar.parent = this.root;

    // ── Wheels (4×) ───────────────────────────────────────────────────────────
    // Each wheel uses a hub TransformNode at the axle centre.
    // Children (tyre, rim, valve marker) are parented to the hub so that
    // spinning the hub around its local X axis (= the car's left-right axle)
    // produces correct rolling motion.  The asymmetric valve stem makes the
    // spin direction clearly visible.
    const axlePositions: Array<[number, number, number]> = [
      [ AXLE_X,  AXLE_Y, FRONT_AXLE_Z],
      [-AXLE_X,  AXLE_Y, FRONT_AXLE_Z],
      [ AXLE_X,  AXLE_Y, REAR_AXLE_Z],
      [-AXLE_X,  AXLE_Y, REAR_AXLE_Z],
    ];

    for (const [x, y, z] of axlePositions) {
      const hub = new TransformNode("wheelHub", scene);
      hub.parent = this.root;
      hub.position.set(x, y, z);

      // Tyre — cylinder rotated so its axis runs along hub-local X
      const tyre = MeshBuilder.CreateCylinder(
        "tyre",
        { diameter: WHEEL_RADIUS * 2, height: WHEEL_THICKNESS, tessellation: 20 },
        scene,
      );
      tyre.rotation.z = Math.PI / 2;
      tyre.parent = hub;
      tyre.material = tireMat;

      // Rim disc inset toward the car body
      const inset = x > 0 ? -0.08 : 0.08;
      const rim = MeshBuilder.CreateCylinder(
        "rim",
        { diameter: WHEEL_RADIUS * 1.15, height: 0.06, tessellation: 16 },
        scene,
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.x = inset;
      rim.parent = hub;
      rim.material = rimMat;

      // Valve-stem marker — small dark nub on the outer tyre face.
      // Orbits the axle as the wheel spins, making rotation clearly visible.
      const outerFace = x > 0 ? WHEEL_THICKNESS / 2 + 0.01 : -(WHEEL_THICKNESS / 2 + 0.01);
      const valve = MeshBuilder.CreateBox(
        "valve",
        { width: 0.04, height: 0.14, depth: 0.07 },
        scene,
      );
      valve.position.set(outerFace, WHEEL_RADIUS * 0.70, 0);
      valve.parent = hub;
      valve.material = rimMat;

      this.wheels.push(hub);
    }
  }

  // ── Tilt ──────────────────────────────────────────────────────────────────

  private updateTilt(deltaSeconds: number): void {
    if (this.airborne) {
      const decay = 1 - Math.pow(0.001, deltaSeconds);
      this.pitch *= 1 - decay * AIR_TILT_DECAY;
      this.roll  *= 1 - decay * AIR_TILT_DECAY;
      return;
    }

    const normal = terrainNormal(this.position.x, this.position.z, this.scratchNormal);
    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);
    const rtX  =  Math.cos(this.heading);
    const rtZ  = -Math.sin(this.heading);

    const targetPitch = clamp(
      Math.atan2(normal.x * fwdX + normal.z * fwdZ, normal.y),
      -MAX_PITCH, MAX_PITCH,
    );
    const targetRoll = clamp(
      Math.atan2(normal.x * rtX + normal.z * rtZ, normal.y),
      -MAX_ROLL, MAX_ROLL,
    );

    const blend = 1 - Math.pow(0.001, deltaSeconds);
    this.pitch += (targetPitch - this.pitch) * blend * TILT_BLEND;
    this.roll  += (targetRoll  - this.roll)  * blend * TILT_BLEND;
  }

  private syncTransform(): void {
    this.root.position.set(this.position.x, this.altitude, this.position.z);
    this.root.rotationQuaternion = Quaternion.FromEulerAngles(
      this.pitch, this.heading, this.roll,
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sampleGroundUnderCar(x: number, z: number, heading: number): number {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  let maxGround = -Infinity;
  for (const [fwd, right] of WHEEL_SAMPLE_OFFSETS) {
    const sx = x + sin * fwd + cos * right;
    const sz = z + cos * fwd - sin * right;
    maxGround = Math.max(maxGround, terrainHeight(sx, sz));
  }
  return maxGround;
}

function box(scene: Scene, name: string, w: number, h: number, d: number): Mesh {
  return MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
}

function mat(
  scene: Scene,
  name: string,
  diffuse: Color3,
  specularStrength = 0.15,
  emissive?: Color3,
): StandardMaterial {
  const m = new StandardMaterial(`mat_${name}`, scene);
  m.diffuseColor  = diffuse;
  m.specularColor = new Color3(specularStrength, specularStrength, specularStrength);
  if (emissive) {
    m.emissiveColor = emissive;
  }
  return m;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
