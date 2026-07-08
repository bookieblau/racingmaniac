import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";
import type { Car } from "./car";
import { isDriftWorld, terrainHeight } from "./worldContext";

const MAX_MARKS = 2000;
const STAMP_SPACING = 0.42;
const MARK_LIFT = 0.035;

export class DriftMarksSystem {
  private readonly scene: Scene;
  private readonly mat: StandardMaterial;
  private readonly pool: Array<Mesh | null>;
  private writeIdx = 0;
  private lastStampX = NaN;
  private lastStampZ = NaN;

  constructor(scene: Scene) {
    this.scene = scene;
    this.pool = new Array<Mesh | null>(MAX_MARKS).fill(null);
    this.mat = new StandardMaterial("driftMarkMat", scene);
    this.mat.diffuseColor = new Color3(0.1, 0.1, 0.11);
    this.mat.specularColor = new Color3(0.02, 0.02, 0.02);
    this.mat.alpha = 0.82;
    this.mat.backFaceCulling = false;
    this.mat.disableLighting = true;
  }

  update(car: Car): void {
    if (!isDriftWorld()) return;
    if (!car.isDrifting() || car.isAirborne() || Math.abs(car.getSpeed()) < 3) return;

    const pos = car.getWorldPosition();
    if (!Number.isNaN(this.lastStampX)) {
      const dx = pos.x - this.lastStampX;
      const dz = pos.z - this.lastStampZ;
      if (dx * dx + dz * dz < STAMP_SPACING * STAMP_SPACING) return;
    }

    this.lastStampX = pos.x;
    this.lastStampZ = pos.z;

    const yaw = car.getHeading();
    const slip = Math.abs(car.getSlipAngle());
    const widthScale = 0.9 + slip * 0.55;
    const lengthScale = 0.75 + Math.min(0.35, Math.abs(car.getSpeed()) / car.getMaxSpeed() * 0.35);
    const wheels = car.getWheelWorldPositions();
    const isBike = wheels.length <= 2;
    const markW = isBike ? 0.14 * widthScale : 0.2 * widthScale;
    const markL = isBike ? 0.55 * lengthScale : 0.68 * lengthScale;

    for (const wheel of wheels) {
      const y = terrainHeight(wheel.x, wheel.z) + MARK_LIFT;
      this.stamp(wheel.x, y, wheel.z, yaw, markW, markL);
    }
  }

  private stamp(
    x: number,
    y: number,
    z: number,
    yaw: number,
    width: number,
    length: number,
  ): void {
    let mark = this.pool[this.writeIdx];
    if (!mark) {
      mark = MeshBuilder.CreateBox(
        `driftMark${this.writeIdx}`,
        { width: 1, height: 0.012, depth: 1 },
        this.scene,
      );
      mark.material = this.mat;
      mark.isPickable = false;
      this.pool[this.writeIdx] = mark;
    }

    mark.position.set(x, y, z);
    mark.rotation.y = yaw;
    mark.scaling.set(width, 1, length);
    mark.setEnabled(true);

    this.writeIdx = (this.writeIdx + 1) % MAX_MARKS;
  }
}
