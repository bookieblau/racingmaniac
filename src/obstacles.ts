export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
}

export class ObstacleField {
  private readonly obstacles: CircleObstacle[];

  constructor(obstacles: CircleObstacle[]) {
    this.obstacles = obstacles;
  }

  static empty(): ObstacleField {
    return new ObstacleField([]);
  }

  get count(): number {
    return this.obstacles.length;
  }

  /** Push the car out of any overlapping tree; returns whether a hit occurred. */
  resolve(x: number, z: number, carRadius: number): { x: number; z: number; hit: boolean } {
    let ox = x;
    let oz = z;
    let hit = false;

    for (const o of this.obstacles) {
      const dx = ox - o.x;
      const dz = oz - o.z;
      const dist = Math.hypot(dx, dz);
      const minDist = carRadius + o.radius;
      if (dist < minDist) {
        hit = true;
        if (dist > 0.001) {
          const scale = minDist / dist;
          ox = o.x + dx * scale;
          oz = o.z + dz * scale;
        }
      }
    }

    return { x: ox, z: oz, hit };
  }
}
