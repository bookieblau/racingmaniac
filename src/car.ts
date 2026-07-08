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
import { CarConfig } from "./carTypes";
import { TERRAIN_SIZE, getObstacles, getRampCrestLaunch, getSurfaceGripMult, isDriftWorld, terrainHeight, terrainNormal } from "./worldContext";

// ── Shared physics constants (not configurable per car) ───────────────────────
const GRAVITY              = 22;
const MIN_STEER_FACTOR     = 0.45;
const PIVOT_STEER_FACTOR   = 0.38; // steer while stationary / coasting without throttle
const GROUND_EPSILON       = 0.05;
const MAX_VERTICAL_VELOCITY = 14;
const LIFTOFF_THRESHOLD    = 15;   // m/s ground-fall rate to trigger liftoff (bikes)
const LIFTOFF_MIN_SPEED    = 7;    // m/s speed required for liftoff (bikes)
const CAR_LIFTOFF_THRESHOLD = 5.5; // cars: easier crest detection
const CAR_LIFTOFF_MIN_SPEED = 4.5;
const CAR_JUMP_BOOST       = 4.8;  // m/s pop off ramp lip
const CAR_JUMP_SPEED_SCALE = 0.12;
const AIR_TILT_DECAY       = 6;
const MAX_PITCH            = 0.28;
const MAX_ROLL             = 0.28;
const MAX_CAR_PITCH        = 0.12;
const MAX_CAR_ROLL         = 0.05;
const CAR_TERRAIN_TILT     = 0.35;
const GRIP_ALIGN_RATE      = 8.5;

// Four-wheel drift (cars only) — body slides sideways while all wheels stay planted.
const DRIFT_MIN_SPEED      = 4;
const MAX_SLIP_ANGLE       = 0.58;
const SLIP_BUILD_RATE      = 6.5;
const SLIP_DECAY_RATE      = 5.0;
const PATH_YAW_BLEND       = 0.82;
const DRIFT_PATH_MIN       = 0.68;
const DRIFT_PATH_SLIP_GAIN = 0.48;
const DRIFT_PATH_PULL      = 5.5;

export class Car {
  readonly root: TransformNode;

  private readonly cfg: CarConfig;
  private readonly wheelSampleOffsets: ReadonlyArray<readonly [number, number]>;

  private readonly halfExtent: number;
  private speed = 0;
  /** Travel direction (momentum path). */
  private pathHeading = 0;
  /** Body yaw offset from path — visible sideways four-wheel slide. */
  private slipAngle = 0;
  /** @deprecated Bikes only — kept for bike physics path. */
  private heading = 0;
  private velocityHeading = 0;
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
  private rampLaunchLockout = 0;
  private rampLaunchStrength = 0;
  private rampLaunchHeight = 0;
  private readonly prevPosition = new Vector3(0, 0, 0);

  constructor(
    scene: Scene,
    cfg: CarConfig,
    state?: { x: number; z: number; heading: number },
  ) {
    this.cfg = cfg;
    if (cfg.kind === "bike") {
      this.wheelSampleOffsets = [
        [0, 0],
        [cfg.frontAxleZ, 0],
        [cfg.rearAxleZ, 0],
      ];
    } else {
      this.wheelSampleOffsets = [
        [0, 0],
        [cfg.frontAxleZ,  0],
        [cfg.rearAxleZ,   0],
        [cfg.frontAxleZ,  cfg.axleX],
        [cfg.frontAxleZ, -cfg.axleX],
        [cfg.rearAxleZ,   cfg.axleX],
        [cfg.rearAxleZ,  -cfg.axleX],
      ];
    }

    this.halfExtent = TERRAIN_SIZE / 2 - 4;

    if (state) {
      this.position.x = state.x;
      this.position.z = state.z;
      this.prevPosition.x = state.x;
      this.prevPosition.z = state.z;
      this.pathHeading = state.heading;
      this.heading = state.heading;
      this.velocityHeading = state.heading;
      this.slipAngle = 0;
    }

    this.root = new TransformNode("carRoot", scene);
    this.buildVisuals(scene);

    this.previousGroundY = this.sampleGround(this.position.x, this.position.z, this.bodyYaw());
    this.altitude = this.previousGroundY + cfg.carBottomOffset;
    this.syncTransform();
  }

  update(deltaSeconds: number, input: InputManager): void {
    const { maxSpeed, acceleration, brake, steerSpeed } = this.cfg;
    // Guard against huge first-frame deltas after menu pauses.
    const dt = Math.min(deltaSeconds, 0.05);

    // ── Throttle / brake ────────────────────────────────────────────────────
    if (input.isActive("forward")) {
      this.speed = Math.min(this.speed + acceleration * dt, maxSpeed);
    } else if (input.isActive("backward")) {
      this.speed = Math.max(this.speed - brake * dt, -maxSpeed * 0.45);
    } else {
      const drag = this.speed > 0 ? -14 : 14;
      const next = this.speed + drag * dt;
      this.speed =
        Math.sign(this.speed) !== Math.sign(next) || Math.abs(next) < 0.2 ? 0 : next;
    }

    const steerDir = input.isActive("left") ? -1 : input.isActive("right") ? 1 : 0;
    const fwdSlopeSin = this.forwardSlopeSin();

    if (this.cfg.kind === "car") {
      this.updateCarDrift(dt, steerDir, steerSpeed, maxSpeed, input, fwdSlopeSin);
    } else {
      this.updateBikeSteer(dt, steerDir, steerSpeed, maxSpeed, input, fwdSlopeSin);
    }

    // ── Slope grip ───────────────────────────────────────────────────────────
    if (fwdSlopeSin > 0.60) {
      const uphillCap = Math.max(
        0,
        maxSpeed * (1.0 - fwdSlopeSin * this.cfg.slopeDragMult),
      );
      if (this.speed > uphillCap) {
        this.speed = Math.max(uphillCap, this.speed - 60 * dt);
      }
    }

    // ── Move along travel heading ───────────────────────────────────────────
    const travelHeading = this.cfg.kind === "car" ? this.pathHeading : this.velocityHeading;
    this.position.x += Math.sin(travelHeading) * this.speed * dt;
    this.position.z += Math.cos(travelHeading) * this.speed * dt;
    this.position.x = clamp(this.position.x, -this.halfExtent, this.halfExtent);
    this.position.z = clamp(this.position.z, -this.halfExtent, this.halfExtent);

    const collision = getObstacles().resolve(
      this.position.x,
      this.position.z,
      this.collisionRadius(),
    );
    if (collision.hit) {
      this.position.x = collision.x;
      this.position.z = collision.z;
      this.speed *= 0.25;
      if (this.cfg.kind === "car") {
        this.slipAngle *= 0.35;
        this.pathHeading += normalizeAngle(this.bodyYaw() - this.pathHeading) * 0.4;
      } else {
        this.velocityHeading += normalizeAngle(this.heading - this.velocityHeading) * 0.5;
      }
    }

    // ── Vertical (jump / gravity) ────────────────────────────────────────────
    const groundY = this.sampleGround(this.position.x, this.position.z, this.bodyYaw());
    const tiltLift = this.cfg.kind === "car"
      ? 0
      : Math.abs(Math.sin(this.pitch)) * 1.1 + Math.abs(Math.sin(this.roll)) * 0.75;
    const groundContact = groundY + this.cfg.carBottomOffset + tiltLift;

    // Rate at which the terrain is dropping under the car (m/s, negative = falling away)
    const groundFallRate = (groundY - this.previousGroundY) / dt;

    this.rampLaunchLockout = Math.max(0, this.rampLaunchLockout - dt);
    this.rampLaunchStrength = 0;
    this.rampLaunchHeight = 0;

    if (this.cfg.kind === "car" && isDriftWorld()) {
      const launch = getRampCrestLaunch(
        this.position.x,
        this.position.z,
        this.prevPosition.x,
        this.prevPosition.z,
        this.getVelocityHeading(),
        this.bodyYaw(),
        this.speed,
        this.cfg.frontAxleZ,
      );
      if (launch) {
        this.rampLaunchStrength = launch.strength;
        this.rampLaunchHeight = launch.height;
      }
    }

    if (!this.airborne) {
      const liftoff = this.cfg.kind === "car"
        ? this.shouldCarLiftoff(fwdSlopeSin, groundFallRate)
        : this.speed >= LIFTOFF_MIN_SPEED && groundFallRate < -LIFTOFF_THRESHOLD;

      if (liftoff) {
        this.airborne = true;
        if (this.cfg.kind === "car") {
          const crestLaunch = this.rampLaunchStrength > 0;
          const dropBoost = crestLaunch ? 0 : Math.min(2.8, this.aheadGroundDrop() * 0.75);
          const speedBoost = Math.max(0, this.speed - CAR_LIFTOFF_MIN_SPEED) * CAR_JUMP_SPEED_SCALE;
          const crestBoost = this.rampLaunchStrength * 5.5;
          this.verticalVelocity = CAR_JUMP_BOOST + dropBoost + speedBoost + crestBoost;
          if (crestLaunch) {
            this.altitude = Math.max(groundContact, this.rampLaunchHeight + this.cfg.carBottomOffset);
            this.rampLaunchLockout = 0.9;
          } else if (this.rampLaunchStrength > 0.35) {
            this.rampLaunchLockout = 0.75;
          }
        } else {
          this.verticalVelocity = 0;
        }
      } else {
        this.altitude = groundContact;
        this.verticalVelocity = 0;
        this.airborne = false;
      }
    } else {
      this.verticalVelocity = Math.max(
        this.verticalVelocity - GRAVITY * dt,
        -MAX_VERTICAL_VELOCITY,
      );
      this.altitude += this.verticalVelocity * dt;

      if (this.altitude <= groundContact) {
        this.altitude = groundContact;
        this.verticalVelocity = 0;
        this.airborne = false;
      } else {
        this.airborne = this.altitude > groundContact + GROUND_EPSILON * 2;
      }
    }

    // ── Wheel spin ──────────────────────────────────────────────────────────
    this.wheelRotation += (this.speed / this.cfg.wheelRadius) * dt;
    const spinQ = Quaternion.FromEulerAngles(this.wheelRotation, 0, 0);
    for (const hub of this.wheels) {
      hub.rotationQuaternion = spinQ;
    }

    this.updateTilt(dt);
    this.previousGroundY = groundY;
    this.prevPosition.x = this.position.x;
    this.prevPosition.z = this.position.z;
    this.syncTransform();
  }

  getWorldPosition(): Vector3 { return this.root.position.clone(); }
  getHeading(): number         { return this.bodyYaw(); }
  getVelocityHeading(): number { return this.cfg.kind === "car" ? this.pathHeading : this.velocityHeading; }
  getSlipAngle(): number       { return this.cfg.kind === "car" ? this.slipAngle : normalizeAngle(this.heading - this.velocityHeading); }
  isDrifting(): boolean {
    if (Math.abs(this.speed) < DRIFT_MIN_SPEED) return false;
    return this.cfg.kind === "car"
      ? Math.abs(this.slipAngle) > 0.16
      : Math.abs(this.getSlipAngle()) > 0.1;
  }
  getSpeed(): number          { return this.speed; }
  getMaxSpeed(): number       { return this.cfg.maxSpeed; }
  isAirborne(): boolean       { return this.airborne; }
  getCarName(): string        { return this.cfg.name; }

  getState(): { x: number; z: number; heading: number } {
    return { x: this.position.x, z: this.position.z, heading: this.bodyYaw() };
  }

  private bodyYaw(): number {
    return this.cfg.kind === "car"
      ? this.pathHeading + this.slipAngle
      : this.heading;
  }

  /** Four-wheel drift: build slip angle, arc path heading, all tyres stay down. */
  private updateCarDrift(
    dt: number,
    steerDir: number,
    steerSpeed: number,
    maxSpeed: number,
    input: InputManager,
    fwdSlopeSin: number,
  ): void {
    const speedRatio = Math.min(1, Math.abs(this.speed) / maxSpeed);
    const grip = this.gripStrength();
    const onSteep = Math.abs(fwdSlopeSin) > 0.35;

    if (Math.abs(this.speed) < 0.5) {
      if (steerDir !== 0) {
        this.pathHeading += steerDir * steerSpeed * PIVOT_STEER_FACTOR * dt;
      }
      this.slipAngle *= Math.max(0, 1 - SLIP_DECAY_RATE * dt * 2);
      return;
    }

    if (steerDir !== 0 && Math.abs(this.speed) > DRIFT_MIN_SPEED && !onSteep) {
      const slipCap = MAX_SLIP_ANGLE * speedRatio * clamp(0.55 / grip, 0.45, 1.1);
      const targetSlip = steerDir * slipCap;
      const build = input.isActive("forward") ? SLIP_BUILD_RATE : SLIP_BUILD_RATE * 0.65;
      this.slipAngle += (targetSlip - this.slipAngle) * build * dt;

      const slipRatio = Math.abs(this.slipAngle) / MAX_SLIP_ANGLE;
      const pathFactor = Math.max(
        DRIFT_PATH_MIN,
        speedRatio * (PATH_YAW_BLEND + DRIFT_PATH_SLIP_GAIN * slipRatio),
      );
      const throttleMult = input.isActive("forward") ? 1.3 : 0.95;
      this.pathHeading += steerDir * steerSpeed * pathFactor * throttleMult * dt;

      // Front wheels bite — pull travel direction toward where the nose is pointing.
      if (slipRatio > 0.15) {
        const pull = normalizeAngle(this.bodyYaw() - this.pathHeading);
        if (Math.sign(pull) === steerDir || Math.abs(pull) < 0.08) {
          this.pathHeading += pull * DRIFT_PATH_PULL * speedRatio * dt;
        }
      }
    } else if (steerDir !== 0) {
      const speedFactor = Math.max(MIN_STEER_FACTOR, speedRatio);
      this.pathHeading += steerDir * steerSpeed * speedFactor * dt;
      this.slipAngle *= Math.max(0, 1 - SLIP_DECAY_RATE * dt);
    } else {
      this.slipAngle *= Math.max(0, 1 - SLIP_DECAY_RATE * dt);
    }

    this.slipAngle = clamp(this.slipAngle, -MAX_SLIP_ANGLE, MAX_SLIP_ANGLE);
    this.heading = this.bodyYaw();
    this.velocityHeading = this.pathHeading;
  }

  /** Bikes use lighter two-heading slide physics. */
  private updateBikeSteer(
    dt: number,
    steerDir: number,
    steerSpeed: number,
    maxSpeed: number,
    input: InputManager,
    fwdSlopeSin: number,
  ): void {
    if (steerDir !== 0) {
      const speedFactor =
        Math.abs(this.speed) > 0.5
          ? Math.max(MIN_STEER_FACTOR, Math.abs(this.speed) / maxSpeed)
          : PIVOT_STEER_FACTOR;
      this.heading += steerDir * steerSpeed * speedFactor * dt;
    }

    if (Math.abs(this.speed) < 0.5) {
      this.velocityHeading = this.heading;
    } else {
      const slip = normalizeAngle(this.heading - this.velocityHeading);
      let grip = this.gripStrength();
      if (Math.abs(this.speed) > 4 && steerDir !== 0) grip *= 0.6;
      if (input.isActive("forward") && Math.abs(slip) > 0.06) grip *= 0.75;
      if (Math.abs(fwdSlopeSin) > 0.35) grip *= 1.4;
      const speedRatio = Math.max(0.25, Math.abs(this.speed) / maxSpeed);
      this.velocityHeading += slip * grip * GRIP_ALIGN_RATE * speedRatio * dt;
    }
    this.pathHeading = this.velocityHeading;
    this.slipAngle = 0;
  }

  private shouldCarLiftoff(fwdSlopeSin: number, groundFallRate: number): boolean {
    if (this.speed < CAR_LIFTOFF_MIN_SPEED) return false;

    // Launch the instant the front axle crosses the crest lip.
    if (this.rampLaunchStrength > 0 && this.rampLaunchLockout <= 0) {
      return true;
    }

    // Keep flat drifts planted — only launch off real crests / ramp lips.
    if (this.isDrifting() && Math.abs(fwdSlopeSin) < 0.2 && groundFallRate > -5) {
      return false;
    }

    const crest = groundFallRate < -CAR_LIFTOFF_THRESHOLD;
    const lipDrop = this.aheadGroundDrop();
    const lip = lipDrop > (isDriftWorld() ? 1.0 : 1.8);

    if (isDriftWorld()) return crest || lip;
    return crest && !this.isDrifting();
  }

  /** How much lower the ground is just ahead along the travel path. */
  private aheadGroundDrop(): number {
    const hdg = this.getVelocityHeading();
    const ahead = 2.8;
    const here = terrainHeight(this.position.x, this.position.z);
    const fwd = terrainHeight(
      this.position.x + Math.sin(hdg) * ahead,
      this.position.z + Math.cos(hdg) * ahead,
    );
    return here - fwd;
  }

  private collisionRadius(): number {
    if (this.cfg.kind === "bike") return 1.1;
    return this.cfg.axleX + 0.85;
  }

  dispose(): void {
    for (const mesh of this.root.getChildMeshes()) {
      if (mesh.material) mesh.material.dispose();
      mesh.dispose();
    }
    for (const node of this.root.getChildTransformNodes()) {
      node.dispose();
    }
    this.root.dispose();
  }

  getWheelWorldPositions(): Vector3[] {
    const { axleX, axleY, frontAxleZ, rearAxleZ, kind } = this.cfg;
    const px = this.root.position.x;
    const py = this.root.position.y;
    const pz = this.root.position.z;
    const sinH = Math.sin(this.bodyYaw());
    const cosH = Math.cos(this.bodyYaw());

    const axles: [number, number, number][] = kind === "bike"
      ? [
          [0, axleY, frontAxleZ],
          [0, axleY, rearAxleZ],
        ]
      : [
          [ axleX,  axleY, frontAxleZ],
          [-axleX,  axleY, frontAxleZ],
          [ axleX,  axleY, rearAxleZ],
          [-axleX,  axleY, rearAxleZ],
        ];

    return axles.map(([lx, ly, lz]) =>
      new Vector3(
        px + lx * cosH + lz * sinH,
        py + ly,
        pz - lx * sinH + lz * cosH,
      ),
    );
  }

  // ── Slope measurement ─────────────────────────────────────────────────────

  /** Sine of the terrain slope in the car's forward direction (+ve = uphill). */
  private forwardSlopeSin(): number {
    const SAMPLE = 1.8;
    const hdg = this.cfg.kind === "car" ? this.pathHeading : this.heading;
    const sx = Math.sin(hdg);
    const sz = Math.cos(hdg);
    const hA = terrainHeight(this.position.x + sx * SAMPLE, this.position.z + sz * SAMPLE);
    const hB = terrainHeight(this.position.x - sx * SAMPLE, this.position.z - sz * SAMPLE);
    const rise = hA - hB;
    const run  = SAMPLE * 2;
    return rise / Math.sqrt(rise * rise + run * run);
  }

  // ── Ground sampling ───────────────────────────────────────────────────────

  private sampleGround(x: number, z: number, heading: number): number {
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    let maxGround = -Infinity;
    for (const [fwd, right] of this.wheelSampleOffsets) {
      const sx = x + sin * fwd + cos * right;
      const sz = z + cos * fwd - sin * right;
      maxGround = Math.max(maxGround, terrainHeight(sx, sz));
    }
    return maxGround;
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
    const bodyYaw = this.bodyYaw();
    const fwdX = Math.sin(bodyYaw);
    const fwdZ = Math.cos(bodyYaw);
    const rtX  =  Math.cos(bodyYaw);
    const rtZ  = -Math.sin(bodyYaw);

    const targetPitch = clamp(
      Math.atan2(normal.x * fwdX + normal.z * fwdZ, normal.y),
      -MAX_PITCH, MAX_PITCH,
    );

    const terrainRoll = Math.atan2(normal.x * rtX + normal.z * rtZ, normal.y);
    let targetRoll = terrainRoll;
    if (this.cfg.kind === "car") {
      // Sideways drift is yaw-only — keep the body level so all four wheels stay down.
      targetRoll = clamp(terrainRoll * CAR_TERRAIN_TILT, -MAX_CAR_ROLL, MAX_CAR_ROLL);
    } else {
      targetRoll += this.getSlipAngle() * Math.min(0.35, Math.abs(this.speed) / this.cfg.maxSpeed * 0.4);
      targetRoll = clamp(targetRoll, -MAX_ROLL, MAX_ROLL);
    }

    const carPitch = clamp(targetPitch * CAR_TERRAIN_TILT, -MAX_CAR_PITCH, MAX_CAR_PITCH);
    const finalPitch = this.cfg.kind === "car" ? carPitch : targetPitch;

    const tiltBlend = this.cfg.kind === "bike" ? 4 : 5;
    const blend = 1 - Math.pow(0.001, deltaSeconds);
    this.pitch += (finalPitch - this.pitch) * blend * tiltBlend;
    this.roll  += (targetRoll  - this.roll)  * blend * tiltBlend;
  }

  /** Higher = less drift. Scales with handling stat and surface. */
  private gripStrength(): number {
    if (this.cfg.kind === "car") {
      const handlingGrip = 0.38 + (this.cfg.statHandling / 100) * 0.48;
      return handlingGrip * getSurfaceGripMult();
    }
    const handlingGrip = 0.48 + (this.cfg.statHandling / 100) * 0.58;
    return handlingGrip * 1.2 * getSurfaceGripMult();
  }

  private syncTransform(): void {
    this.root.position.set(this.position.x, this.altitude, this.position.z);
    this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(
      this.bodyYaw(), this.pitch, this.roll,
    );
  }

  // ── Build visuals (dispatches to one of four builders) ────────────────────

  private buildVisuals(scene: Scene): void {
    switch (this.cfg.id) {
      case "buggy":     this.buildBuggy(scene);     break;
      case "monster":   this.buildMonster(scene);   break;
      case "racer":     this.buildRacer(scene);     break;
      case "crawler":   this.buildCrawler(scene);   break;
      case "dirtbike":  this.buildDirtBike(scene);  break;
      case "sportbike": this.buildSportBike(scene); break;
      case "chopper":   this.buildChopper(scene);   break;
    }
  }

  // ── 1. Dune Buggy ─────────────────────────────────────────────────────────

  private buildBuggy(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ, axleX } = this.cfg;
    const bodyC  = hex(this.cfg.bodyColorHex);
    const darkC  = bodyC.scale(0.75);
    const BODY_Y  = axleY + 0.28;
    const CABIN_Y = BODY_Y + 0.28 + 0.38;

    const bodyMat   = mat(scene, "body",   bodyC);
    const hoodMat   = mat(scene, "hood",   new Color3(0.82, 0.68, 0.08));
    const glassMat  = mat(scene, "glass",  new Color3(0.35, 0.60, 0.88), 0.05);
    const bumperMat = mat(scene, "bumper", new Color3(0.22, 0.22, 0.22), 0.3);
    const rollMat   = mat(scene, "roll",   new Color3(0.30, 0.30, 0.28), 0.35);
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));
    const brakeMat  = mat(scene, "brake",  new Color3(0.85, 0.18, 0.12), 0.0, new Color3(0.6, 0.05, 0.05));

    attach(scene, this.root, "body",  2.05, 0.56, 3.22, 0, BODY_Y, 0, bodyMat);
    attach(scene, this.root, "hood",  1.72, 0.16, 1.10, 0, BODY_Y + 0.36, 0.88, hoodMat);
    attach(scene, this.root, "cabin", 1.62, 0.76, 1.68, 0, CABIN_Y, -0.18, bodyMat);
    attach(scene, this.root, "ws",    1.38, 0.58, 0.07, 0, CABIN_Y + 0.02, 0.68, glassMat, [-0.22, 0, 0]);
    attach(scene, this.root, "rw",    1.32, 0.50, 0.07, 0, CABIN_Y + 0.02, -1.02, glassMat, [0.22, 0, 0]);
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `sw${s}`, 0.07, 0.44, 1.20, s * 0.815, CABIN_Y + 0.05, -0.18, glassMat);
    }
    attach(scene, this.root, "fbump", 2.14, 0.30, 0.22, 0, axleY + 0.12, frontAxleZ + 0.24, bumperMat);
    attach(scene, this.root, "rbump", 2.10, 0.26, 0.20, 0, axleY + 0.12, rearAxleZ  - 0.22, bumperMat);
    attach(scene, this.root, "rbar",  1.56, 0.09, 0.09, 0, CABIN_Y + 0.42, -0.18, rollMat);
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `hl${s}`, 0.26, 0.18, 0.07, s * 0.72, BODY_Y + 0.10, frontAxleZ + 0.14, lightMat);
      attach(scene, this.root, `tl${s}`, 0.24, 0.16, 0.07, s * 0.72, BODY_Y + 0.10, rearAxleZ  - 0.12, brakeMat);
    }

    void darkC; // suppress unused-variable lint
    this.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.78, 0.78, 0.78), new Color3(0.15, 0.14, 0.13));
  }

  // ── 2. Monster Truck ──────────────────────────────────────────────────────

  private buildMonster(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ, axleX } = this.cfg;
    const bodyC   = hex(this.cfg.bodyColorHex);
    const BODY_Y  = axleY + 0.32;
    const CABIN_Y = BODY_Y + 0.60 + 0.48;

    const bodyMat    = mat(scene, "body",    bodyC);
    const darkMat    = mat(scene, "dark",    bodyC.scale(0.65));
    const glassMat   = mat(scene, "glass",   new Color3(0.35, 0.60, 0.88), 0.05);
    const bumperMat  = mat(scene, "bumper",  new Color3(0.18, 0.18, 0.18), 0.3);
    const rollMat    = mat(scene, "roll",    new Color3(0.28, 0.28, 0.25), 0.35);
    const flameMat   = mat(scene, "flame",   new Color3(1.0, 0.55, 0.0), 0.0, new Color3(0.5, 0.22, 0.0));
    const lightMat   = mat(scene, "light",   new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));

    // Wide boxy body
    attach(scene, this.root, "body",  2.60, 0.64, 3.20, 0, BODY_Y, 0, bodyMat);
    // Hood with central scoop
    attach(scene, this.root, "hood",  2.40, 0.22, 1.30, 0, BODY_Y + 0.42, 0.92, darkMat);
    attach(scene, this.root, "scoop", 0.60, 0.28, 0.90, 0, BODY_Y + 0.54, 0.76, bodyMat);
    // Cabin
    attach(scene, this.root, "cabin", 2.20, 0.82, 1.80, 0, CABIN_Y, -0.16, bodyMat);
    attach(scene, this.root, "ws",    1.82, 0.60, 0.08, 0, CABIN_Y + 0.04, 0.78, glassMat, [-0.20, 0, 0]);
    attach(scene, this.root, "rw",    1.74, 0.52, 0.08, 0, CABIN_Y + 0.04, -1.08, glassMat, [0.20, 0, 0]);
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `sw${s}`, 0.08, 0.52, 1.30, s * 1.105, CABIN_Y + 0.06, -0.16, glassMat);
    }
    // Heavy bumpers
    attach(scene, this.root, "fbump", 2.80, 0.46, 0.28, 0, BODY_Y + 0.06, frontAxleZ + 0.30, bumperMat);
    attach(scene, this.root, "rbump", 2.76, 0.38, 0.24, 0, BODY_Y + 0.06, rearAxleZ  - 0.28, bumperMat);
    // Fender flares
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `ffF${s}`, 0.26, 0.34, 1.10, s * 1.46, BODY_Y + 0.14, frontAxleZ - 0.06, darkMat);
      attach(scene, this.root, `ffR${s}`, 0.26, 0.34, 1.10, s * 1.46, BODY_Y + 0.14, rearAxleZ  + 0.06, darkMat);
    }
    // Exhaust stacks (vertical cylinders on each side)
    for (const s of [-1, 1] as const) {
      const ex = MeshBuilder.CreateCylinder(`ex${s}`, { diameter: 0.14, height: 1.10, tessellation: 8 }, scene);
      ex.position.set(s * 1.22, BODY_Y + 0.80, rearAxleZ + 0.40);
      ex.parent = this.root;
      ex.material = bumperMat;
    }
    // Flame decal on sides (emissive orange strip)
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `fl${s}`, 0.06, 0.22, 2.00, s * 1.31, BODY_Y + 0.24, -0.10, flameMat);
    }
    // Roll cage top bar
    attach(scene, this.root, "rbar", 2.14, 0.10, 0.10, 0, CABIN_Y + 0.46, -0.16, rollMat);
    // Headlights (4 × round)
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `hl${s}`,  0.32, 0.22, 0.08, s * 0.84, BODY_Y + 0.18, frontAxleZ + 0.16, lightMat);
      attach(scene, this.root, `hl2${s}`, 0.32, 0.22, 0.08, s * 0.32, BODY_Y + 0.18, frontAxleZ + 0.16, lightMat);
    }

    this.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.70, 0.72, 0.74), new Color3(0.12, 0.12, 0.12));
  }

  // ── 3. Desert Racer ───────────────────────────────────────────────────────

  private buildRacer(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ, axleX } = this.cfg;
    const bodyC   = hex(this.cfg.bodyColorHex);
    const BODY_Y  = axleY + 0.20;
    const CABIN_Y = BODY_Y + 0.36 + 0.28;

    const bodyMat   = mat(scene, "body",   bodyC);
    const darkMat   = mat(scene, "dark",   bodyC.scale(0.70));
    const glassMat  = mat(scene, "glass",  new Color3(0.35, 0.60, 0.88), 0.05);
    const bumperMat = mat(scene, "bumper", new Color3(0.18, 0.18, 0.18), 0.3);
    const rollMat   = mat(scene, "roll",   new Color3(0.32, 0.32, 0.30), 0.4);
    const numMat    = mat(scene, "num",    new Color3(0.96, 0.96, 0.96));
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));
    const brakeMat  = mat(scene, "brake",  new Color3(0.85, 0.18, 0.12), 0.0, new Color3(0.6, 0.05, 0.05));

    // Long low body
    attach(scene, this.root, "body",    1.88, 0.40, 3.60, 0, BODY_Y, 0, bodyMat);
    // Front splitter (thin wide strip below nose)
    attach(scene, this.root, "split",   2.00, 0.06, 0.50, 0, BODY_Y - 0.14, frontAxleZ + 0.34, bumperMat);
    // Open cockpit (short windscreen + rollbar only)
    attach(scene, this.root, "cockpit", 1.50, 0.52, 1.40, 0, CABIN_Y, -0.18, darkMat);
    attach(scene, this.root, "ws",      1.36, 0.46, 0.07, 0, CABIN_Y + 0.02, 0.58, glassMat, [-0.18, 0, 0]);
    // Roll hoop
    attach(scene, this.root, "rhoop",   0.10, 0.68, 0.10, -0.60, CABIN_Y + 0.10, -0.72, rollMat);
    attach(scene, this.root, "rhoop2",  0.10, 0.68, 0.10,  0.60, CABIN_Y + 0.10, -0.72, rollMat);
    attach(scene, this.root, "rbar",    1.30, 0.09, 0.09,  0,    CABIN_Y + 0.44, -0.72, rollMat);
    // Rear wing (two uprights + flat plate)
    const wingY = BODY_Y + 0.66;
    attach(scene, this.root, "wu1",   0.08, 0.50, 0.08, -0.60, BODY_Y + 0.25, rearAxleZ - 0.10, bumperMat);
    attach(scene, this.root, "wu2",   0.08, 0.50, 0.08,  0.60, BODY_Y + 0.25, rearAxleZ - 0.10, bumperMat);
    attach(scene, this.root, "wing",  1.36, 0.08, 0.46,  0,    wingY,          rearAxleZ - 0.10, darkMat);
    // Number panel on sides
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `np${s}`, 0.06, 0.30, 0.90, s * 0.97, BODY_Y + 0.22, -0.06, numMat);
    }
    // Bumpers
    attach(scene, this.root, "fbump", 1.96, 0.24, 0.18, 0, BODY_Y + 0.04, frontAxleZ + 0.24, bumperMat);
    attach(scene, this.root, "rbump", 1.92, 0.22, 0.16, 0, BODY_Y + 0.04, rearAxleZ  - 0.20, bumperMat);
    // Lights
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `hl${s}`, 0.28, 0.14, 0.06, s * 0.68, BODY_Y + 0.08, frontAxleZ + 0.12, lightMat);
      attach(scene, this.root, `tl${s}`, 0.24, 0.12, 0.06, s * 0.68, BODY_Y + 0.08, rearAxleZ  - 0.10, brakeMat);
    }

    this.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.85, 0.82, 0.10), new Color3(0.14, 0.14, 0.14));
  }

  // ── 4. Rock Crawler ───────────────────────────────────────────────────────

  private buildCrawler(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ, axleX } = this.cfg;
    const bodyC   = hex(this.cfg.bodyColorHex);
    const BODY_Y  = axleY + 0.34;
    const CABIN_Y = BODY_Y + 0.58 + 0.44;

    const bodyMat   = mat(scene, "body",   bodyC);
    const darkMat   = mat(scene, "dark",   bodyC.scale(0.70));
    const glassMat  = mat(scene, "glass",  new Color3(0.35, 0.60, 0.88), 0.05);
    const bumperMat = mat(scene, "bumper", new Color3(0.20, 0.18, 0.16), 0.3);
    const rollMat   = mat(scene, "roll",   new Color3(0.36, 0.34, 0.30), 0.4);
    const rackMat   = mat(scene, "rack",   new Color3(0.24, 0.22, 0.18), 0.5);
    const tireMat   = mat(scene, "tire",   new Color3(0.13, 0.13, 0.12));
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));
    const brakeMat  = mat(scene, "brake",  new Color3(0.85, 0.18, 0.12), 0.0, new Color3(0.6, 0.05, 0.05));

    // Boxy body
    attach(scene, this.root, "body",  2.12, 0.60, 2.72, 0, BODY_Y, 0, bodyMat);
    // Hood
    attach(scene, this.root, "hood",  1.88, 0.16, 1.10, 0, BODY_Y + 0.38, 0.70, darkMat);
    // Boxy cabin
    attach(scene, this.root, "cabin", 2.08, 0.88, 1.72, 0, CABIN_Y, -0.14, bodyMat);
    attach(scene, this.root, "ws",    1.72, 0.66, 0.08, 0, CABIN_Y + 0.02, 0.74, glassMat, [-0.20, 0, 0]);
    attach(scene, this.root, "rw",    1.68, 0.58, 0.08, 0, CABIN_Y + 0.02, -1.00, glassMat, [0.20, 0, 0]);
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `sw${s}`, 0.08, 0.56, 1.30, s * 1.05, CABIN_Y + 0.06, -0.14, glassMat);
    }
    // Roof rack (longitudinal + cross bars)
    const rackY = CABIN_Y + 0.48;
    attach(scene, this.root, "rl1", 0.06, 0.05, 1.52, -0.72, rackY, -0.14, rackMat);
    attach(scene, this.root, "rl2", 0.06, 0.05, 1.52,  0.72, rackY, -0.14, rackMat);
    attach(scene, this.root, "rc1", 1.52, 0.05, 0.06,  0, rackY, 0.40, rackMat);
    attach(scene, this.root, "rc2", 1.52, 0.05, 0.06,  0, rackY, -0.14, rackMat);
    attach(scene, this.root, "rc3", 1.52, 0.05, 0.06,  0, rackY, -0.68, rackMat);
    // Spare tyre on back (cylinder laid flat)
    const spare = MeshBuilder.CreateCylinder("spare",
      { diameter: this.cfg.wheelRadius * 1.9, height: 0.28, tessellation: 16 }, scene);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, BODY_Y + 0.30, rearAxleZ - 0.28);
    spare.parent = this.root;
    spare.material = tireMat;
    // Heavy front bumper + skid plate
    attach(scene, this.root, "fbump",  2.30, 0.40, 0.26, 0, BODY_Y + 0.08, frontAxleZ + 0.26, bumperMat);
    attach(scene, this.root, "skid",   1.90, 0.10, 0.70, 0, BODY_Y - 0.24, frontAxleZ - 0.02, bumperMat);
    attach(scene, this.root, "rbump",  2.26, 0.34, 0.22, 0, BODY_Y + 0.08, rearAxleZ  - 0.24, bumperMat);
    // Fender flares
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `ffF${s}`, 0.22, 0.28, 0.90, s * 1.14, BODY_Y + 0.14, frontAxleZ - 0.04, darkMat);
      attach(scene, this.root, `ffR${s}`, 0.22, 0.28, 0.90, s * 1.14, BODY_Y + 0.14, rearAxleZ  + 0.04, darkMat);
    }
    // Roll cage visible through open sides
    attach(scene, this.root, "rbar", 2.02, 0.10, 0.10, 0, CABIN_Y + 0.48, -0.14, rollMat);
    // Lights
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `hl${s}`, 0.30, 0.22, 0.08, s * 0.76, BODY_Y + 0.16, frontAxleZ + 0.16, lightMat);
      attach(scene, this.root, `tl${s}`, 0.26, 0.18, 0.08, s * 0.76, BODY_Y + 0.14, rearAxleZ  - 0.14, brakeMat);
    }

    this.addWheels(scene, axleX, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.62, 0.60, 0.56), new Color3(0.14, 0.13, 0.12));
  }

  // ── Shared wheel builder ──────────────────────────────────────────────────

  private addWheels(
    scene: Scene,
    axleX: number, axleY: number, frontAxleZ: number, rearAxleZ: number,
    rimColor: Color3, tireColor: Color3,
  ): void {
    const { wheelRadius: wr, wheelThickness: wt } = this.cfg;
    const tireMat = mat(scene, "tire", tireColor);
    const rimMat  = mat(scene, "rim",  rimColor, 0.55);

    const axlePositions: [number, number, number][] = [
      [ axleX, axleY, frontAxleZ],
      [-axleX, axleY, frontAxleZ],
      [ axleX, axleY, rearAxleZ],
      [-axleX, axleY, rearAxleZ],
    ];

    for (const [x, y, z] of axlePositions) {
      const hub = new TransformNode("wheelHub", scene);
      hub.parent = this.root;
      hub.position.set(x, y, z);

      const tyre = MeshBuilder.CreateCylinder("tyre",
        { diameter: wr * 2, height: wt, tessellation: 20 }, scene);
      tyre.rotation.z = Math.PI / 2;
      tyre.parent = hub;
      tyre.material = tireMat;

      const inset = x > 0 ? -0.08 : 0.08;
      const rim = MeshBuilder.CreateCylinder("rim",
        { diameter: wr * 1.15, height: 0.06, tessellation: 16 }, scene);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = inset;
      rim.parent = hub;
      rim.material = rimMat;

      // Valve-stem marker so wheel spin is visible
      const outerFace = x > 0 ? wt / 2 + 0.01 : -(wt / 2 + 0.01);
      const valve = MeshBuilder.CreateBox("valve",
        { width: 0.04, height: wr * 0.27, depth: 0.07 }, scene);
      valve.position.set(outerFace, wr * 0.70, 0);
      valve.parent = hub;
      valve.material = rimMat;

      this.wheels.push(hub);
    }
  }

  // ── 5. Dirt Bike ──────────────────────────────────────────────────────────

  private buildDirtBike(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ } = this.cfg;
    const bodyC = hex(this.cfg.bodyColorHex);
    const FRAME_Y = axleY + 0.52;

    const frameMat  = mat(scene, "frame",  new Color3(0.18, 0.18, 0.20), 0.4);
    const bodyMat   = mat(scene, "body",   bodyC);
    const darkMat   = mat(scene, "dark",   bodyC.scale(0.65));
    const seatMat   = mat(scene, "seat",   new Color3(0.12, 0.12, 0.12), 0.1);
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));

    // Main frame triangle
    attach(scene, this.root, "frameD", 0.10, 0.10, 1.55, 0, FRAME_Y - 0.18, -0.06, frameMat);
    attach(scene, this.root, "frameU", 0.10, 0.10, 1.20, 0, FRAME_Y + 0.08, 0.02, frameMat);
    // Engine block
    attach(scene, this.root, "engine", 0.32, 0.36, 0.42, 0, axleY + 0.28, -0.04, darkMat);
    // Fuel tank
    attach(scene, this.root, "tank",   0.30, 0.22, 0.52, 0, FRAME_Y + 0.02, 0.08, bodyMat);
    // Seat
    attach(scene, this.root, "seat",   0.28, 0.10, 0.55, 0, FRAME_Y + 0.12, -0.28, seatMat);
    // Front forks
    attach(scene, this.root, "forkL",  0.06, 0.52, 0.06, -0.10, axleY + 0.42, frontAxleZ - 0.08, frameMat);
    attach(scene, this.root, "forkR",  0.06, 0.52, 0.06,  0.10, axleY + 0.42, frontAxleZ - 0.08, frameMat);
    // Handlebars
    attach(scene, this.root, "hbar",   0.62, 0.06, 0.06, 0, FRAME_Y + 0.28, frontAxleZ - 0.12, frameMat);
    // Front fender
    attach(scene, this.root, "ffend",  0.34, 0.06, 0.28, 0, axleY + 0.52, frontAxleZ + 0.06, bodyMat);
    // Rear fender / mudguard
    attach(scene, this.root, "rfend",  0.30, 0.06, 0.50, 0, axleY + 0.48, rearAxleZ + 0.12, bodyMat);
    // Headlight
    attach(scene, this.root, "hl", 0.16, 0.14, 0.10, 0, FRAME_Y + 0.18, frontAxleZ + 0.04, lightMat);
    // Exhaust
    attach(scene, this.root, "exh", 0.10, 0.10, 0.55, 0.14, axleY + 0.22, rearAxleZ + 0.10, frameMat);

    this.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.75, 0.75, 0.75), new Color3(0.14, 0.13, 0.12));
  }

  // ── 6. Sport Bike ─────────────────────────────────────────────────────────

  private buildSportBike(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ } = this.cfg;
    const bodyC = hex(this.cfg.bodyColorHex);
    const FRAME_Y = axleY + 0.46;

    const bodyMat   = mat(scene, "body",   bodyC);
    const darkMat   = mat(scene, "dark",   new Color3(0.10, 0.10, 0.12), 0.3);
    const fairMat   = mat(scene, "fair",   bodyC.scale(0.85));
    const glassMat  = mat(scene, "glass",  new Color3(0.35, 0.60, 0.88), 0.05);
    const seatMat   = mat(scene, "seat",   new Color3(0.08, 0.08, 0.10), 0.1);
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));

    // Low frame
    attach(scene, this.root, "frame", 0.08, 0.08, 1.65, 0, FRAME_Y - 0.14, -0.02, darkMat);
    // Engine
    attach(scene, this.root, "engine", 0.36, 0.30, 0.50, 0, axleY + 0.22, -0.06, darkMat);
    // Fairing nose
    attach(scene, this.root, "nose", 0.42, 0.28, 0.55, 0, FRAME_Y + 0.04, frontAxleZ - 0.18, fairMat);
    // Windscreen
    attach(scene, this.root, "ws", 0.36, 0.30, 0.06, 0, FRAME_Y + 0.22, frontAxleZ - 0.10, glassMat, [-0.28, 0, 0]);
    // Side fairings
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `fair${s}`, 0.08, 0.32, 0.70, s * 0.22, FRAME_Y - 0.02, -0.04, fairMat);
    }
    // Fuel tank (rider area)
    attach(scene, this.root, "tank", 0.34, 0.18, 0.48, 0, FRAME_Y + 0.06, 0.02, bodyMat);
    // Seat (single piece sport)
    attach(scene, this.root, "seat", 0.30, 0.08, 0.72, 0, FRAME_Y + 0.10, -0.30, seatMat);
    // Tail fairing
    attach(scene, this.root, "tail", 0.28, 0.22, 0.40, 0, FRAME_Y + 0.02, rearAxleZ + 0.04, fairMat);
    // Clip-on handlebars
    attach(scene, this.root, "hbar", 0.54, 0.05, 0.05, 0, FRAME_Y + 0.20, frontAxleZ - 0.14, darkMat);
    // Forks
    attach(scene, this.root, "forkL", 0.05, 0.44, 0.05, -0.08, axleY + 0.36, frontAxleZ - 0.06, darkMat);
    attach(scene, this.root, "forkR", 0.05, 0.44, 0.05,  0.08, axleY + 0.36, frontAxleZ - 0.06, darkMat);
    // Headlight
    attach(scene, this.root, "hl", 0.14, 0.12, 0.08, 0, FRAME_Y + 0.10, frontAxleZ + 0.02, lightMat);
    // Tail light
    attach(scene, this.root, "tl", 0.12, 0.08, 0.06, 0, FRAME_Y + 0.06, rearAxleZ - 0.06,
      mat(scene, "brake", new Color3(0.85, 0.18, 0.12), 0.0, new Color3(0.6, 0.05, 0.05)));

    this.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
      new Color3(0.88, 0.85, 0.10), new Color3(0.12, 0.12, 0.12));
  }

  // ── 7. Desert Chopper ─────────────────────────────────────────────────────

  private buildChopper(scene: Scene): void {
    const { axleY, frontAxleZ, rearAxleZ, wheelRadius: wr } = this.cfg;
    const bodyC = hex(this.cfg.bodyColorHex);
    const FRAME_Y = axleY + 0.58;

    const chromeMat = mat(scene, "chrome", new Color3(0.82, 0.82, 0.86), 0.7);
    const bodyMat   = mat(scene, "body",   bodyC);
    const darkMat   = mat(scene, "dark",   new Color3(0.14, 0.12, 0.10), 0.2);
    const seatMat   = mat(scene, "seat",   new Color3(0.18, 0.10, 0.06), 0.1);
    const lightMat  = mat(scene, "light",  new Color3(1.0, 0.96, 0.82), 0.0, new Color3(0.9, 0.85, 0.6));

    // Rigid frame
    attach(scene, this.root, "frame", 0.12, 0.12, 1.90, 0, FRAME_Y - 0.22, -0.04, chromeMat);
    // Teardrop tank
    attach(scene, this.root, "tank", 0.38, 0.26, 0.62, 0, FRAME_Y + 0.04, 0.04, bodyMat);
    // Solo seat
    attach(scene, this.root, "seat", 0.36, 0.12, 0.50, 0, FRAME_Y + 0.14, -0.30, seatMat);
    // Engine (V-twin block)
    attach(scene, this.root, "engine", 0.40, 0.34, 0.48, 0, axleY + 0.30, -0.06, darkMat);
    // Long front forks
    attach(scene, this.root, "forkL", 0.07, 0.88, 0.07, -0.12, axleY + 0.62, frontAxleZ - 0.20, chromeMat);
    attach(scene, this.root, "forkR", 0.07, 0.88, 0.07,  0.12, axleY + 0.62, frontAxleZ - 0.20, chromeMat);
    // Ape-hanger handlebars
    attach(scene, this.root, "hbar", 0.72, 0.06, 0.06, 0, FRAME_Y + 0.42, -0.08, chromeMat);
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `hgrip${s}`, 0.06, 0.22, 0.06, s * 0.36, FRAME_Y + 0.52, -0.08, darkMat);
    }
    // Sissy bar behind seat
    attach(scene, this.root, "sissy", 0.08, 0.55, 0.08, 0, FRAME_Y + 0.38, rearAxleZ + 0.18, chromeMat);
    attach(scene, this.root, "sissyT", 0.42, 0.06, 0.06, 0, FRAME_Y + 0.66, rearAxleZ + 0.18, chromeMat);
    // Front fender
    attach(scene, this.root, "ffend", 0.40, 0.08, 0.32, 0, axleY + 0.58, frontAxleZ + 0.08, chromeMat);
    // Rear fender
    attach(scene, this.root, "rfend", 0.46, 0.08, 0.55, 0, axleY + 0.52, rearAxleZ + 0.14, chromeMat);
    // Headlight (round, large)
    const hl = MeshBuilder.CreateCylinder("hl",
      { diameter: 0.28, height: 0.10, tessellation: 12 }, scene);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, FRAME_Y + 0.20, frontAxleZ + 0.06);
    hl.parent = this.root;
    hl.material = lightMat;
    // Exhaust pipes (both sides)
    for (const s of [-1, 1] as const) {
      attach(scene, this.root, `exh${s}`, 0.08, 0.08, 0.80, s * 0.20, axleY + 0.18, rearAxleZ + 0.20, chromeMat);
    }

    // Chopper has a visually larger rear wheel
    this.addBikeWheels(scene, axleY, frontAxleZ, rearAxleZ,
      chromeMat.diffuseColor, new Color3(0.12, 0.11, 0.10),
      wr * 1.18);  // rear wheel scale
  }

  // ── Bike wheel builder (2 wheels on centreline) ───────────────────────────

  private addBikeWheels(
    scene: Scene,
    axleY: number, frontAxleZ: number, rearAxleZ: number,
    rimColor: Color3, tireColor: Color3,
    rearScale = 1.0,
  ): void {
    const { wheelRadius: wr, wheelThickness: wt } = this.cfg;
    const tireMat = mat(scene, "tire", tireColor);
    const rimMat  = mat(scene, "rim",  rimColor, 0.55);

    const positions: [number, number, number, number][] = [
      [0, axleY, frontAxleZ, 1.0],
      [0, axleY, rearAxleZ,  rearScale],
    ];

    for (const [x, y, z, scale] of positions) {
      const hub = new TransformNode("wheelHub", scene);
      hub.parent = this.root;
      hub.position.set(x, y, z);

      const r = wr * scale;
      const tyre = MeshBuilder.CreateCylinder("tyre",
        { diameter: r * 2, height: wt, tessellation: 20 }, scene);
      tyre.rotation.z = Math.PI / 2;
      tyre.parent = hub;
      tyre.material = tireMat;

      const rim = MeshBuilder.CreateCylinder("rim",
        { diameter: r * 1.12, height: 0.05, tessellation: 16 }, scene);
      rim.rotation.z = Math.PI / 2;
      rim.parent = hub;
      rim.material = rimMat;

      const valve = MeshBuilder.CreateBox("valve",
        { width: 0.04, height: r * 0.25, depth: 0.06 }, scene);
      valve.position.set(wt / 2 + 0.01, r * 0.68, 0);
      valve.parent = hub;
      valve.material = rimMat;

      this.wheels.push(hub);
    }
  }
}

// ── Module helpers ────────────────────────────────────────────────────────────

function attach(
  scene: Scene,
  root: TransformNode,
  name: string,
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
  return m;
}

function mat(
  scene: Scene,
  name: string,
  diffuse: Color3,
  specularStrength = 0.15,
  emissive?: Color3,
): StandardMaterial {
  const m = new StandardMaterial(`mat_${name}_${Math.random().toString(36).slice(2, 6)}`, scene);
  m.diffuseColor  = diffuse;
  m.specularColor = new Color3(specularStrength, specularStrength, specularStrength);
  if (emissive) m.emissiveColor = emissive;
  return m;
}

function hex(h: string): Color3 {
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  return new Color3(r, g, b);
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
