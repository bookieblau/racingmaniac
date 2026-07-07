import {
  Color3,
  Mesh,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import { terrainHeight } from "./terrain";
import type { Car } from "./car";

// Pool of pre-built quad meshes that get recycled as the car drives.
// Two segments are stamped per interval (left-rear and right-rear wheel).
const POOL_SIZE  = 400;  // ~3-4 s of tracks at full speed before recycling
const MIN_DIST   = 0.45; // m between stamps
const HALF_WIDTH = 0.21; // half the painted-tread width in metres
const LIFT       = 0.06; // m above terrain to prevent z-fighting

export class TrackSystem {
  private readonly pool: Mesh[];
  private poolIdx = 0;
  private prevL: Vector3 | null = null;
  private prevR: Vector3 | null = null;

  constructor(scene: Scene) {
    const mat = new StandardMaterial("trackMat", scene);
    mat.diffuseColor    = new Color3(0.24, 0.16, 0.08);
    mat.specularColor   = Color3.Black();
    mat.alpha           = 0.70;
    mat.backFaceCulling = false;

    // Render after the opaque terrain (group 0) so depth never z-fights
    const ZERO_POS = new Float32Array(12);
    const FLAT_NRM = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const INDICES  = new Uint32Array([0, 1, 2, 0, 2, 3]);

    this.pool = Array.from({ length: POOL_SIZE }, (_, i) => {
      const m  = new Mesh(`trkSeg_${i}`, scene);
      const vd = new VertexData();
      vd.positions = ZERO_POS;
      vd.normals   = FLAT_NRM;
      vd.indices   = INDICES;
      vd.applyToMesh(m, true /* updatable */);
      m.material        = mat;
      m.isVisible       = false;
      m.isPickable      = false;
      m.renderingGroupId = 1; // over terrain, still depth-tested
      return m;
    });
  }

  update(car: Car): void {
    if (car.isAirborne() || car.getSpeed() < 1.5) {
      this.prevL = null;
      this.prevR = null;
      return;
    }

    const w    = car.getWheelWorldPositions();
    const curL = w[3]!; // left-rear
    const curR = w[2]!; // right-rear

    if (!this.prevL) {
      this.prevL = curL.clone();
      this.prevR = curR.clone();
      return;
    }

    if (Vector3.Distance(curL, this.prevL) >= MIN_DIST) {
      this.stamp(this.prevL, curL);
      this.stamp(this.prevR!, curR);
      this.prevL = curL.clone();
      this.prevR = curR.clone();
    }
  }

  private stamp(from: Vector3, to: Vector3): void {
    const m = this.pool[this.poolIdx]!;
    this.poolIdx = (this.poolIdx + 1) % POOL_SIZE;

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.02) return;

    // Perpendicular offset for track width
    const nx = (-dz / len) * HALF_WIDTH;
    const nz = ( dx / len) * HALF_WIDTH;

    const y1 = terrainHeight(from.x, from.z) + LIFT;
    const y2 = terrainHeight(to.x,   to.z)   + LIFT;

    m.updateVerticesData(VertexBuffer.PositionKind, new Float32Array([
      from.x + nx, y1, from.z + nz,  // 0 from-left
      from.x - nx, y1, from.z - nz,  // 1 from-right
      to.x   - nx, y2, to.z   - nz,  // 2 to-right
      to.x   + nx, y2, to.z   + nz,  // 3 to-left
    ]));
    m.isVisible = true;
  }
}
