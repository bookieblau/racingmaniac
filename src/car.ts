import { Mesh, MeshBuilder, Quaternion, Scene, Vector3 } from "@babylonjs/core";
import { InputManager } from "./input";
import { TERRAIN_SIZE, terrainHeight } from "./terrain";

const HALF_EXTENT = TERRAIN_SIZE / 2 - 4;

const GRAVITY = 22;
const MAX_SPEED = 34;
const ACCELERATION = 28;
const BRAKE = 40;
const STEER_SPEED = 2.4;
const WHEEL_OFFSET = 0.55;
const GROUND_EPSILON = 0.08;

export class Car {
  readonly mesh: Mesh;
  private speed = 0;
  private heading = 0;
  private altitude = 0;
  private verticalVelocity = 0;
  private previousGroundY = 0;
  private readonly position = new Vector3(0, 0, 0);

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateBox(
      "car",
      { width: 1.6, height: 0.7, depth: 2.8 },
      scene,
    );
    this.mesh.position.copyFrom(this.position);
    this.previousGroundY = terrainHeight(0, 0);
    this.altitude = this.previousGroundY + WHEEL_OFFSET;
    this.syncMesh();
  }

  update(deltaSeconds: number, input: InputManager): void {
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

    if (Math.abs(this.speed) > 0.5) {
      const steerDirection = input.isActive("left") ? 1 : input.isActive("right") ? -1 : 0;
      const steerFactor = Math.min(Math.abs(this.speed) / MAX_SPEED, 1);
      this.heading += steerDirection * STEER_SPEED * steerFactor * deltaSeconds;
    }

    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);
    this.position.x += forwardX * this.speed * deltaSeconds;
    this.position.z += forwardZ * this.speed * deltaSeconds;

    this.position.x = clamp(this.position.x, -HALF_EXTENT, HALF_EXTENT);
    this.position.z = clamp(this.position.z, -HALF_EXTENT, HALF_EXTENT);

    const groundY = terrainHeight(this.position.x, this.position.z);
    const onGround =
      this.altitude <= groundY + WHEEL_OFFSET + GROUND_EPSILON && this.verticalVelocity <= 0;

    if (onGround) {
      const rampImpulse = (groundY - this.previousGroundY) * 30;
      this.altitude = groundY + WHEEL_OFFSET;
      this.verticalVelocity = Math.max(0, rampImpulse);

      if (Math.abs(rampImpulse) > 0.05 && this.speed > 8) {
        this.verticalVelocity = Math.max(this.verticalVelocity, rampImpulse * 1.4);
      }
    } else {
      this.verticalVelocity -= GRAVITY * deltaSeconds;
      this.altitude += this.verticalVelocity * deltaSeconds;

      if (this.altitude < groundY + WHEEL_OFFSET) {
        this.altitude = groundY + WHEEL_OFFSET;
        this.verticalVelocity = 0;
      }
    }

    this.previousGroundY = groundY;
    this.syncMesh();
  }

  getWorldPosition(): Vector3 {
    return this.mesh.position.clone();
  }

  getHeading(): number {
    return this.heading;
  }

  private syncMesh(): void {
    this.mesh.position.set(this.position.x, this.altitude, this.position.z);
    this.mesh.rotationQuaternion = Quaternion.FromEulerAngles(0, this.heading, 0);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
