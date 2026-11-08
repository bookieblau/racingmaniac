import {
  Color3,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import { InputManager } from "./input";
import { CarConfig, CarTypeId } from "./carTypes";
import { buildVehicleVisuals } from "./vehicleVisuals";
import { getActiveWorld, getObstacles, getRampCrestLaunch, getSurfaceGripMult, getTerrainSize, isDriftWorld, terrainHeight, terrainNormal } from "./worldContext";

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
const MAX_WHEELIE_PITCH    = 0.50; // ~29°, bikes only
const WHEELIE_RISE_RATE    = 3.2;  // smoothing speed while holding wheelie+gas
const WHEELIE_FALL_RATE    = 7.0;  // snappier drop when released
const WHEELIE_STEER_PENALTY = 0.6; // fraction of steer authority lost at max wheelie
const MAX_ROLL             = 0.28;
const MAX_CAR_PITCH        = 0.12;
const MAX_CAR_ROLL         = 0.05;
const CAR_TERRAIN_TILT     = 0.35;
const GRIP_ALIGN_RATE      = 8.5;
const ROLLING_RESIST       = 2.4;
const AERO_DRAG_COEFF      = 0.02;
const ENGINE_BRAKE         = 5.5;
const WEIGHT_TRANSFER_GAIN = 0.011;
const LANDING_PITCH_GAIN   = 0.018;
const HIGH_SPEED_UNDERSTEER = 2.4;

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
  /** Bikes only — front-wheel-lift angle, added on top of terrain pitch for rendering. */
  private wheelieAngle = 0;
  private airborne = false;
  private wheelRotation = 0;
  private weightTransferPitch = 0;
  private landImpactPitch = 0;
  private visualSteer = 0;
  private lastSteerDir = 0;
  private readonly wheels: TransformNode[] = [];
  private readonly wheelHubLayout: Array<{ x: number; z: number; restY: number }> = [];
  private readonly brakeLightMats: StandardMaterial[] = [];
  private readonly headlightMats: StandardMaterial[] = [];
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

    this.halfExtent = getTerrainSize() / 2 - 4;

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
    const mass = this.vehicleMassScale();
    if (input.isActive("forward")) {
      this.speed = Math.min(this.speed + (acceleration / mass) * dt, maxSpeed);
    } else if (input.isActive("backward")) {
      this.speed = Math.max(this.speed - brake * Math.sqrt(mass) * dt, -maxSpeed * 0.45);
    } else {
      const v = Math.abs(this.speed);
      const sign = this.speed >= 0 ? 1 : -1;
      const powerScale = 0.9 + (this.cfg.statPower / 100) * 0.25;
      const decel =
        (ROLLING_RESIST + ENGINE_BRAKE + AERO_DRAG_COEFF * v * v) * powerScale;
      const next = this.speed - sign * decel * dt;
      this.speed =
        Math.sign(this.speed) !== Math.sign(next) || Math.abs(next) < 0.15 ? 0 : next;
    }

    const steerDir = input.isActive("left") ? -1 : input.isActive("right") ? 1 : 0;
    this.lastSteerDir = steerDir;
    const fwdSlopeSin = this.forwardSlopeSin();

    if (this.cfg.kind === "car") {
      this.updateCarDrift(dt, steerDir, steerSpeed, maxSpeed, input, fwdSlopeSin);
    } else {
      this.updateWheelie(dt, input);
      const steerPenalty = 1 - WHEELIE_STEER_PENALTY * (this.wheelieAngle / MAX_WHEELIE_PITCH);
      this.updateBikeSteer(dt, steerDir, steerSpeed * steerPenalty, maxSpeed, input, fwdSlopeSin);
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
          const spd = Math.max(0, this.speed - LIFTOFF_MIN_SPEED);
          this.verticalVelocity =
            getActiveWorld() === "moto"
              ? 1.05 + spd * 0.2
              : 0;
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
        const impact = Math.max(0, -this.verticalVelocity);
        if (impact > 3.5 && this.cfg.kind === "car") {
          this.landImpactPitch = Math.min(0.14, impact * LANDING_PITCH_GAIN);
        }
        this.altitude = groundContact;
        this.verticalVelocity = 0;
        this.airborne = false;
      } else {
        this.airborne = this.altitude > groundContact + GROUND_EPSILON * 2;
      }
    }

    this.updateWheelSuspension();
    this.updateVehicleLights(input);

    // ── Wheel spin + front steer ──────────────────────────────────────────────
    const slipSpin = this.isDrifting() ? Math.abs(this.getSlipAngle()) * 3.2 : 0;
    this.wheelRotation += ((this.speed / this.cfg.wheelRadius) + slipSpin) * dt;
    const speedRatio = Math.min(1, Math.abs(this.speed) / maxSpeed);
    const steerTarget =
      steerDir * (0.12 + speedRatio * 0.26) + (this.cfg.kind === "car" ? this.slipAngle * 0.32 : 0);
    const steerBlend = 1 - Math.pow(0.001, dt);
    this.visualSteer += (steerTarget - this.visualSteer) * steerBlend * 14;

    const spinQ = Quaternion.FromEulerAngles(this.wheelRotation, 0, 0);
    const steerQ = Quaternion.RotationAxis(Vector3.Up(), this.visualSteer);
    for (let i = 0; i < this.wheels.length; i++) {
      const hub = this.wheels[i]!;
      const isFront = this.cfg.kind === "bike" ? i === 0 : i < 2;
      hub.rotationQuaternion = isFront ? steerQ.multiply(spinQ) : spinQ;
    }

    this.updateWeightTransfer(dt, input);
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
  getTypeId(): CarTypeId      { return this.cfg.id; }
  isBike(): boolean            { return this.cfg.kind === "bike"; }
  getBodyPitch(): number       { return this.pitch; }
  getBodyRoll(): number        { return this.roll; }

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
      const understeer = 1 / (1 + speedRatio * speedRatio * HIGH_SPEED_UNDERSTEER);
      this.pathHeading += steerDir * steerSpeed * speedFactor * understeer * dt;
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
      const speedRatio = Math.min(1, Math.abs(this.speed) / maxSpeed);
      const understeer = 1 / (1 + speedRatio * speedRatio * HIGH_SPEED_UNDERSTEER);
      this.heading += steerDir * steerSpeed * speedFactor * understeer * dt;
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

  /** Bikes only — holding wheelie+gas while grounded lifts the front wheel. */
  private updateWheelie(dt: number, input: InputManager): void {
    const wantWheelie =
      !this.airborne && input.isActive("wheelie") && input.isActive("forward");
    const target = wantWheelie ? MAX_WHEELIE_PITCH : 0;
    const rate = wantWheelie ? WHEELIE_RISE_RATE : WHEELIE_FALL_RATE;
    const blend = 1 - Math.pow(0.001, dt);
    this.wheelieAngle += (target - this.wheelieAngle) * blend * rate;
    if (Math.abs(this.wheelieAngle) < 0.001) this.wheelieAngle = 0;
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

  /** Longitudinal load transfer from throttle / brake. */
  private updateWeightTransfer(dt: number, input: InputManager): void {
    const maxSp = this.cfg.maxSpeed;
    let target = 0;
    if (input.isActive("forward") && !this.airborne) {
      target = -WEIGHT_TRANSFER_GAIN * Math.min(1, Math.abs(this.speed) / maxSp);
    } else if (input.isActive("backward") && !this.airborne) {
      target = WEIGHT_TRANSFER_GAIN * Math.min(1, Math.abs(this.speed) / maxSp) * 1.1;
    }

    const blend = 1 - Math.pow(0.001, dt);
    this.weightTransferPitch += (target - this.weightTransferPitch) * blend * 9;

    if (this.landImpactPitch !== 0) {
      this.landImpactPitch *= 1 - blend * 12;
      if (Math.abs(this.landImpactPitch) < 0.002) this.landImpactPitch = 0;
    }
  }

  /** Pitch from front vs rear wheel ride height (cars). */
  private suspensionPitch(): number {
    const hdg = this.bodyYaw();
    const sin = Math.sin(hdg);
    const cos = Math.cos(hdg);
    const { frontAxleZ, rearAxleZ } = this.cfg;
    const frontY = terrainHeight(
      this.position.x + sin * frontAxleZ,
      this.position.z + cos * frontAxleZ,
    );
    const rearY = terrainHeight(
      this.position.x + sin * rearAxleZ,
      this.position.z + cos * rearAxleZ,
    );
    const wheelbase = Math.max(0.5, frontAxleZ - rearAxleZ);
    return clamp(Math.atan2(frontY - rearY, wheelbase), -MAX_CAR_PITCH, MAX_CAR_PITCH);
  }

  /** Roll from left vs right wheel ride height (cars). */
  private suspensionRoll(): number {
    const hdg = this.bodyYaw();
    const sin = Math.sin(hdg);
    const cos = Math.cos(hdg);
    const { axleX, frontAxleZ, rearAxleZ } = this.cfg;
    if (axleX < 0.01) return 0;

    const sample = (lx: number, lz: number) =>
      terrainHeight(
        this.position.x + sin * lz + cos * lx,
        this.position.z + cos * lz - sin * lx,
      );

    const leftY = (sample(-axleX, frontAxleZ) + sample(-axleX, rearAxleZ)) * 0.5;
    const rightY = (sample(axleX, frontAxleZ) + sample(axleX, rearAxleZ)) * 0.5;
    const track = axleX * 2;
    return clamp(Math.atan2(leftY - rightY, track), -MAX_CAR_ROLL, MAX_CAR_ROLL);
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
      const suspPitch = this.suspensionPitch();
      const suspRoll = this.suspensionRoll();
      targetRoll = clamp(suspRoll * 0.85 + terrainRoll * CAR_TERRAIN_TILT * 0.35, -MAX_CAR_ROLL, MAX_CAR_ROLL);
    } else {
      const speedRatio = Math.min(1, Math.abs(this.speed) / this.cfg.maxSpeed);
      const lean = this.lastSteerDir * speedRatio * 0.5;
      targetRoll += lean + this.getSlipAngle() * Math.min(0.35, speedRatio * 0.4);
      targetRoll = clamp(targetRoll, -MAX_ROLL, MAX_ROLL);
    }

    let finalPitch: number;
    if (this.cfg.kind === "car") {
      const suspPitch = this.suspensionPitch();
      const base = suspPitch * 0.9 + targetPitch * CAR_TERRAIN_TILT * 0.4;
      finalPitch = clamp(
        base + this.weightTransferPitch + this.landImpactPitch,
        -MAX_CAR_PITCH,
        MAX_CAR_PITCH,
      );
    } else {
      finalPitch = clamp(
        targetPitch + this.weightTransferPitch * 0.65,
        -MAX_PITCH,
        MAX_PITCH,
      );
    }

    const tiltBlend = this.cfg.kind === "bike" ? 4 : 5;
    const blend = 1 - Math.pow(0.001, deltaSeconds);
    this.pitch += (finalPitch - this.pitch) * blend * tiltBlend;
    this.roll  += (targetRoll  - this.roll)  * blend * tiltBlend;
  }

  /** Heavier vehicles (high power stat) accelerate slower but brake harder. */
  private vehicleMassScale(): number {
    return 0.68 + (this.cfg.statPower / 100) * 0.58;
  }

  private createHeadlightMat(scene: Scene): StandardMaterial {
    const m = mat(scene, "light", new Color3(0.96, 0.94, 0.88), 0.35, new Color3(0.45, 0.42, 0.35), 0.2);
    this.headlightMats.push(m);
    return m;
  }

  private createBrakeMat(scene: Scene): StandardMaterial {
    const m = mat(scene, "brake", new Color3(0.75, 0.12, 0.08), 0.2, new Color3(0.25, 0.04, 0.02), 0.35);
    this.brakeLightMats.push(m);
    return m;
  }

  private updateVehicleLights(input: InputManager): void {
    const head = input.isActive("forward") ? 1 : 0.4;
    for (const m of this.headlightMats) {
      m.emissiveColor.set(head * 0.92, head * 0.86, head * 0.7);
    }
    const braking = input.isActive("backward");
    const tail = braking ? 1 : 0.22;
    for (const m of this.brakeLightMats) {
      m.emissiveColor.set(tail * 0.95, tail * 0.12, tail * 0.06);
    }
  }

  private tireProfile(): "knobby" | "slick" | "street" {
    switch (this.cfg.id) {
      case "racer":
      case "sportbike":
        return "slick";
      case "crawler":
      case "monster":
      case "dirtbike":
        return "knobby";
      default:
        return "street";
    }
  }

  private updateWheelSuspension(): void {
    const sin = Math.sin(this.bodyYaw());
    const cos = Math.cos(this.bodyYaw());
    const chassisGround = this.altitude + this.cfg.carBottomOffset;

    for (let i = 0; i < this.wheels.length; i++) {
      const layout = this.wheelHubLayout[i];
      if (!layout) continue;

      const wx = this.position.x + sin * layout.z + cos * layout.x;
      const wz = this.position.z + cos * layout.z - sin * layout.x;
      const ground = terrainHeight(wx, wz);
      const travel = clamp(ground - chassisGround - layout.restY + 0.04, -0.1, 0.15);
      this.wheels[i]!.position.y = layout.restY + travel;
    }
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
    // Wheelie (bikes only): render with extra nose-up pitch, and lift the root
    // just enough that the rear wheel — not the body centre — stays pinned to
    // the ground-contact height already computed for `this.pitch`.
    // Note: negative pitch = nose up in this engine's convention, so the
    // wheelie angle is *subtracted* to raise the front.
    const renderPitch = this.pitch - this.wheelieAngle;
    const wheelieLift = this.wheelieAngle !== 0
      ? (Math.sin(renderPitch) - Math.sin(this.pitch)) * this.cfg.rearAxleZ
      : 0;

    this.root.position.set(this.position.x, this.altitude + wheelieLift, this.position.z);
    this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(
      this.bodyYaw(), renderPitch, this.roll,
    );
  }

  // ── Build visuals (vehicleVisuals.ts) ─────────────────────────────────────

  private buildVisuals(scene: Scene): void {
    buildVehicleVisuals(this.cfg.id, scene, this.root, this.cfg, {
      addWheels: (s, axleX, axleY, fz, rz, rim, tire) =>
        this.addWheels(s, axleX, axleY, fz, rz, rim, tire),
      addBikeWheels: (s, axleY, fz, rz, rim, tire, rearScale) =>
        this.addBikeWheels(s, axleY, fz, rz, rim, tire, rearScale),
      createHeadlightMat: (s) => this.createHeadlightMat(s),
      createBrakeMat: (s) => this.createBrakeMat(s),
    });
  }

  // ── Shared wheel builder ──────────────────────────────────────────────────

  private addWheels(
    scene: Scene,
    axleX: number, axleY: number, frontAxleZ: number, rearAxleZ: number,
    rimColor: Color3, tireColor: Color3,
  ): void {
    const { wheelRadius: wr, wheelThickness: wt } = this.cfg;
    const tireMat = tireMatFor(scene, tireColor);
    const rimMat  = mat(scene, "rim", rimColor, 0.62, undefined, 0.22);
    const profile = this.tireProfile();

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
      this.wheelHubLayout.push({ x, z, restY: y });

      const tyre = MeshBuilder.CreateCylinder("tyre",
        { diameter: wr * 2, height: wt, tessellation: 24 }, scene);
      tyre.rotation.z = Math.PI / 2;
      tyre.parent = hub;
      tyre.material = tireMat;

      const inset = x > 0 ? -0.08 : 0.08;
      const rim = MeshBuilder.CreateCylinder("rim",
        { diameter: wr * 1.15, height: 0.06, tessellation: 20 }, scene);
      rim.rotation.z = Math.PI / 2;
      rim.position.x = inset;
      rim.parent = hub;
      rim.material = rimMat;

      const outerFace = x > 0 ? wt / 2 + 0.01 : -(wt / 2 + 0.01);
      const valve = MeshBuilder.CreateBox("valve",
        { width: 0.04, height: wr * 0.27, depth: 0.07 }, scene);
      valve.position.set(outerFace, wr * 0.70, 0);
      valve.parent = hub;
      valve.material = rimMat;

      const caliper = MeshBuilder.CreateBox("caliper",
        { width: 0.08, height: 0.12, depth: 0.16 }, scene);
      caliper.position.set(x > 0 ? wt / 2 + 0.02 : -(wt / 2 + 0.02), -wr * 0.05, 0);
      caliper.parent = hub;
      caliper.material = mat(scene, "caliper", new Color3(0.18, 0.18, 0.2), 0.4, undefined, 0.4);

      addWheelTread(scene, hub, wr, wt, profile);

      this.wheels.push(hub);
    }
  }

  // ── Bike wheel builder (2 wheels on centreline) ───────────────────────────

  private addBikeWheels(
    scene: Scene,
    axleY: number, frontAxleZ: number, rearAxleZ: number,
    rimColor: Color3, tireColor: Color3,
    rearScale = 1.0,
  ): void {
    const { wheelRadius: wr, wheelThickness: wt } = this.cfg;
    const tireMat = tireMatFor(scene, tireColor);
    const rimMat  = mat(scene, "rim", rimColor, 0.62, undefined, 0.22);
    const profile = this.tireProfile();

    const positions: [number, number, number, number][] = [
      [0, axleY, frontAxleZ, 1.0],
      [0, axleY, rearAxleZ,  rearScale],
    ];

    for (const [x, y, z, scale] of positions) {
      const hub = new TransformNode("wheelHub", scene);
      hub.parent = this.root;
      hub.position.set(x, y, z);
      this.wheelHubLayout.push({ x, z, restY: y });

      const r = wr * scale;
      const tyre = MeshBuilder.CreateCylinder("tyre",
        { diameter: r * 2, height: wt, tessellation: 24 }, scene);
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

      addWheelTread(scene, hub, r, wt, profile);

      this.wheels.push(hub);
    }
  }
}

// ── Module helpers ────────────────────────────────────────────────────────────

function mat(
  scene: Scene,
  name: string,
  diffuse: Color3,
  specularStrength = 0.15,
  emissive?: Color3,
  roughness = 0.5,
): StandardMaterial {
  const m = new StandardMaterial(`mat_${name}_${Math.random().toString(36).slice(2, 6)}`, scene);
  m.diffuseColor = diffuse;
  m.specularColor = new Color3(specularStrength, specularStrength, specularStrength);
  m.specularPower = 8 + (1 - roughness) * 96;
  m.ambientColor = diffuse.scale(0.32);
  if (emissive) m.emissiveColor = emissive;
  return m;
}

function tireMatFor(scene: Scene, tint: Color3): StandardMaterial {
  const base = new Color3(
    tint.r * 0.25 + 0.06,
    tint.g * 0.25 + 0.06,
    tint.b * 0.25 + 0.065,
  );
  return mat(scene, "tire", base, 0.05, undefined, 0.9);
}

function addWheelTread(
  scene: Scene,
  hub: TransformNode,
  radius: number,
  thickness: number,
  profile: "knobby" | "slick" | "street",
): void {
  if (profile === "slick") return;

  const treadMat = mat(scene, "tread", new Color3(0.1, 0.1, 0.11), 0.04, undefined, 0.88);
  const count = profile === "knobby" ? 12 : 8;
  const lift = profile === "knobby" ? 0.05 : 0.028;
  const width = profile === "knobby" ? 0.1 : 0.07;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const block = MeshBuilder.CreateBox(`tread${i}`, { width, height: lift, depth: thickness * 0.35 }, scene);
    block.position.set(Math.cos(a) * (radius * 0.94), Math.sin(a) * (radius * 0.94), 0);
    block.rotation.z = a;
    block.parent = hub;
    block.material = treadMat;
  }
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
