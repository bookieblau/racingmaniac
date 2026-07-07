import { FreeCamera, Vector3 } from "@babylonjs/core";
import { Car } from "./car";
import { terrainHeight } from "./terrain";

const FOLLOW_DISTANCE = 14;
const FOLLOW_HEIGHT = 6.5;
const AIR_EXTRA_HEIGHT = 3;
const LOOK_AHEAD = 2;
const CAMERA_GROUND_CLEARANCE = 2.5;

// Exponential-smoothing time constants (seconds).
// Smaller = faster response; larger = smoother / more lag.
const CAR_Y_TAU    = 0.14;  // smooth raw car altitude before feeding into camera
const LOOK_AT_TAU  = 0.07;  // smooth the look-at target Y

export class ChaseCamera {
  private readonly smoothPosition = new Vector3();
  private readonly lookAt = new Vector3();
  private smoothedCarY = 0;
  private lookAtY = 0;

  constructor(
    private readonly camera: FreeCamera,
    car: Car,
  ) {
    const start = car.getWorldPosition();
    const heading = car.getHeading();
    this.smoothedCarY = start.y;
    this.lookAtY = start.y + 1.1;
    this.smoothPosition.set(
      start.x - Math.sin(heading) * FOLLOW_DISTANCE,
      start.y + FOLLOW_HEIGHT,
      start.z - Math.cos(heading) * FOLLOW_DISTANCE,
    );
    this.camera.position.copyFrom(this.smoothPosition);
    this.lookAt.copyFrom(start);
    this.camera.setTarget(this.lookAt);
  }

  reset(car: Car): void {
    const start = car.getWorldPosition();
    const heading = car.getHeading();
    this.smoothedCarY = start.y;
    this.lookAtY = start.y + 1.1;
    this.smoothPosition.set(
      start.x - Math.sin(heading) * FOLLOW_DISTANCE,
      start.y + FOLLOW_HEIGHT,
      start.z - Math.cos(heading) * FOLLOW_DISTANCE,
    );
    this.camera.position.copyFrom(this.smoothPosition);
    this.lookAt.copyFrom(start);
    this.camera.setTarget(this.lookAt);
  }

  update(car: Car, deltaSeconds: number): void {
    const carPosition = car.getWorldPosition();
    const heading = car.getHeading();
    const speedRatio = Math.min(Math.abs(car.getSpeed()) / car.getMaxSpeed(), 1);

    // Smooth the car's raw Y so the camera doesn't jiggle with terrain snapping.
    const carYBlend   = 1 - Math.exp(-deltaSeconds / CAR_Y_TAU);
    const lookAtBlend = 1 - Math.exp(-deltaSeconds / LOOK_AT_TAU);
    this.smoothedCarY += (carPosition.y - this.smoothedCarY) * carYBlend;
    this.lookAtY      += (carPosition.y + 1.1 - this.lookAtY) * lookAtBlend;

    const distance = FOLLOW_DISTANCE + speedRatio * 5;
    const heightAboveCar = FOLLOW_HEIGHT + (car.isAirborne() ? AIR_EXTRA_HEIGHT : 0);

    const behindX = -Math.sin(heading) * distance;
    const behindZ = -Math.cos(heading) * distance;

    const desiredX = carPosition.x + behindX;
    const desiredZ = carPosition.z + behindZ;

    // Desired Y uses the smoothed car altitude, kept clear of terrain at camera spot.
    const groundAtCamera = terrainHeight(desiredX, desiredZ);
    const desiredY = Math.max(
      this.smoothedCarY + heightAboveCar,
      groundAtCamera + CAMERA_GROUND_CLEARANCE,
    );

    // XZ snaps immediately (heading lag would feel sluggish), Y is already smoothed.
    this.smoothPosition.x = desiredX;
    this.smoothPosition.z = desiredZ;
    this.smoothPosition.y = desiredY;

    this.lookAt.set(
      carPosition.x + Math.sin(heading) * LOOK_AHEAD,
      this.lookAtY,
      carPosition.z + Math.cos(heading) * LOOK_AHEAD,
    );

    this.camera.position.copyFrom(this.smoothPosition);
    this.camera.setTarget(this.lookAt);
  }
}
