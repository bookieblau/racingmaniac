import { FreeCamera, Vector3 } from "@babylonjs/core";
import { Car } from "./car";
import { terrainHeight } from "./terrain";

const FOLLOW_DISTANCE = 14;
const FOLLOW_HEIGHT = 6.5;
const AIR_EXTRA_HEIGHT = 3;
const LOOK_AHEAD = 2;
const CAMERA_GROUND_CLEARANCE = 2.5;

export class ChaseCamera {
  private readonly smoothPosition = new Vector3();
  private readonly lookAt = new Vector3();

  constructor(
    private readonly camera: FreeCamera,
    car: Car,
  ) {
    const start = car.getWorldPosition();
    const heading = car.getHeading();
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
    const frameBlend = 1 - Math.pow(0.001, deltaSeconds);
    const carPosition = car.getWorldPosition();
    const heading = car.getHeading();
    const speedRatio = Math.min(Math.abs(car.getSpeed()) / car.getMaxSpeed(), 1);

    const distance = FOLLOW_DISTANCE + speedRatio * 5;
    const heightAboveCar = FOLLOW_HEIGHT + (car.isAirborne() ? AIR_EXTRA_HEIGHT : 0);

    const behindX = -Math.sin(heading) * distance;
    const behindZ = -Math.cos(heading) * distance;

    const desiredX = carPosition.x + behindX;
    const desiredZ = carPosition.z + behindZ;

    // Desired Y is behind-car height, but never below the terrain at that spot.
    const groundAtCamera = terrainHeight(desiredX, desiredZ);
    const desiredY = Math.max(
      carPosition.y + heightAboveCar,
      groundAtCamera + CAMERA_GROUND_CLEARANCE,
    );

    this.smoothPosition.x = desiredX;
    this.smoothPosition.z = desiredZ;
    this.smoothPosition.y += (desiredY - this.smoothPosition.y) * frameBlend * 12;

    this.lookAt.set(
      carPosition.x + Math.sin(heading) * LOOK_AHEAD,
      carPosition.y + 1.1,
      carPosition.z + Math.cos(heading) * LOOK_AHEAD,
    );

    this.camera.position.copyFrom(this.smoothPosition);
    this.camera.setTarget(this.lookAt);
  }
}
